#!/usr/bin/env bash
# Restaura un respaldo del colegio.
#
#   sudo ./restaurar.sh                      lista los respaldos disponibles
#   sudo ./restaurar.sh <archivo.sql.gz>     restaura ese respaldo
#
# ESTO BORRA LOS DATOS ACTUALES y los reemplaza por los del respaldo. Por eso
# pide escribir el nombre de la base para confirmar: en el dia en que hace
# falta restaurar, la gente esta nerviosa y no conviene que un enter de mas
# borre el trabajo de la semana.
#
# Antes de reemplazar nada saca una copia de seguridad de lo que hay, para que
# equivocarse de archivo no sea irreversible.

set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if [[ -f entorno ]]; then
  set -a
  # shellcheck disable=SC1091
  source entorno
  set +a
fi

DESTINO="${RESPALDOS:-/var/respaldos-escolares}"
PUERTO_SISTEMA="${PORT:-3000}"
SERVICIO="${SERVICIO_SISTEMA:-sistema-escolar}"

decir() { echo "[restaurar] $*"; }
morir() { echo "[restaurar] ERROR: $*" >&2; exit 1; }

[[ "$EUID" -eq 0 ]] || morir "necesita permisos de administrador. Usa: sudo $0 $*"
[[ -n "${DATABASE_URL:-}" ]] || morir "falta DATABASE_URL en el archivo 'entorno'"

BASE="$(printf '%s' "$DATABASE_URL" | sed -E 's|^[^/]*//[^/]*/||; s|\?.*$||')"
[[ -n "$BASE" ]] || morir "no se pudo leer el nombre de la base de DATABASE_URL"

# El usuario con el que trabaja el sistema. Hace falta porque las tablas
# restauradas tienen que quedar a su nombre: si quedan a nombre de 'postgres',
# la restauracion parece exitosa y el sistema no ve ni una tabla.
USUARIO_BD="$(python3 -I -c "
import sys, urllib.parse
print(urllib.parse.urlsplit(sys.argv[1]).username or '')
" "$DATABASE_URL" 2>/dev/null)"
[[ -n "$USUARIO_BD" ]] || morir "no se pudo leer el usuario de DATABASE_URL"

# psql no entiende los parametros que agrega Prisma a la cadena de conexion
# (schema, connection_limit...): se queja de "invalid URI query parameter". Se
# arma una cadena limpia, quedandose solo con los parametros que si conoce.
URL_PSQL="$(python3 -I -c "
import sys, urllib.parse
p = urllib.parse.urlsplit(sys.argv[1])
conocidos = {'sslmode','sslcert','sslkey','sslrootcert','connect_timeout',
             'application_name','options','target_session_attrs'}
q = [(k, v) for k, v in urllib.parse.parse_qsl(p.query) if k in conocidos]
print(urllib.parse.urlunsplit((p.scheme, p.netloc, p.path,
      urllib.parse.urlencode(q), '')))
" "$DATABASE_URL" 2>/dev/null)"
[[ -n "$URL_PSQL" ]] || morir "no se pudo interpretar DATABASE_URL"

# Si el colegio usa un esquema distinto de 'public', hay que decirselo a psql
# por separado, porque ese parametro se quito de la cadena.
ESQUEMA="$(python3 -I -c "
import sys, urllib.parse
print(dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(sys.argv[1]).query)).get('schema','public'))
" "$DATABASE_URL" 2>/dev/null)"
ESQUEMA="${ESQUEMA:-public}"
export PGOPTIONS="-c search_path=${ESQUEMA}"

archivo="${1:-}"

# --- Sin argumento: mostrar que hay --------------------------------------

if [[ -z "$archivo" ]]; then
  echo
  echo "Respaldos disponibles en $DESTINO:"
  echo
  if ! find "$DESTINO" -maxdepth 1 -name "*.sql.gz" -printf '  %TY-%Tm-%Td %TH:%TM  %6s bytes  %p\n' 2>/dev/null | sort -r | head -40 | grep .; then
    echo "  (ninguno)"
  fi
  echo
  echo "Para restaurar uno:"
  echo "  sudo $0 <archivo>"
  echo
  exit 0
fi

[[ -f "$archivo" ]] || morir "no existe el archivo '$archivo'"
gzip -t "$archivo" 2>/dev/null || morir "'$archivo' esta dañado o no es un respaldo comprimido"

# --- Confirmacion --------------------------------------------------------

echo
echo "==================================================================="
echo " Esto va a REEMPLAZAR todos los datos de la base '$BASE'"
echo " por el contenido de:"
echo
echo "     $archivo"
echo "     ($(du -h "$archivo" | cut -f1), del $(date -r "$archivo" '+%d/%m/%Y %H:%M'))"
echo
echo " Lo que haya ahora en '$BASE' se guarda primero en una copia de"
echo " seguridad, por si te equivocaste de archivo."
echo "==================================================================="
echo
read -r -p "Escribe el nombre de la base para confirmar ($BASE): " confirmacion
if [[ "$confirmacion" != "$BASE" ]]; then
  decir "no coincide; no se toco nada."
  exit 1
fi

# --- Detener el sistema para que nadie escriba durante la restauracion ----

detenido=0
if systemctl is-active --quiet "$SERVICIO" 2>/dev/null; then
  decir "deteniendo el sistema para que nadie escriba mientras se restaura"
  systemctl stop "$SERVICIO" && detenido=1
fi

volver_a_levantar() {
  if [[ "$detenido" == "1" ]]; then
    decir "levantando el sistema otra vez"
    systemctl start "$SERVICIO" || decir "AVISO: no se pudo levantar '$SERVICIO'; hazlo a mano."
  fi
}

# --- Copia de seguridad de lo que hay ahora ------------------------------

mkdir -p "$DESTINO"
antes="$DESTINO/${BASE}-ANTES-DE-RESTAURAR-$(date +%Y-%m-%d_%H%M).sql.gz"
decir "guardando el estado actual en $antes"
if su postgres -c "pg_dump --no-owner --no-privileges '$BASE'" | gzip > "$antes" && gzip -t "$antes"; then
  chmod 600 "$antes"
  decir "copia de seguridad lista ($(du -h "$antes" | cut -f1))"
else
  rm -f "$antes"
  volver_a_levantar
  morir "no se pudo respaldar el estado actual; no se restauro nada"
fi

# --- Restaurar -----------------------------------------------------------

decir "vaciando y restaurando '$BASE'"
su postgres -c "psql -tAc \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$BASE'\"" >/dev/null 2>&1

# Se recrea el esquema en lugar de borrar la base, para no tener que volver a
# crearla con su dueño. El esquema nuevo queda a nombre del usuario del
# sistema: recreado como 'postgres' y sin este paso, el sistema no alcanza
# ninguna tabla y la restauracion parece exitosa estando rota.
if ! su postgres -c "psql -q --set ON_ERROR_STOP=on \
      -c 'DROP SCHEMA \"$ESQUEMA\" CASCADE' \
      -c 'CREATE SCHEMA \"$ESQUEMA\"' \
      -c 'ALTER SCHEMA \"$ESQUEMA\" OWNER TO \"$USUARIO_BD\"' \
      -c 'GRANT ALL ON SCHEMA \"$ESQUEMA\" TO \"$USUARIO_BD\"' \
      '$BASE'" >/dev/null 2>&1; then
  volver_a_levantar
  morir "no se pudo vaciar la base; nada se perdio (tu copia esta en $antes)"
fi

# La restauracion se hace CON EL USUARIO DEL SISTEMA, no con 'postgres', para
# que las tablas queden a su nombre. El respaldo se saca con --no-owner
# justamente para que el dueño lo ponga quien restaura.
registro="$(mktemp)"
if ! gunzip -c "$archivo" | psql -q --set ON_ERROR_STOP=on "$URL_PSQL" > "$registro" 2>&1; then
  decir "la restauracion fallo. Primeras lineas:"
  head -10 "$registro" >&2
  rm -f "$registro"
  decir "Para volver a como estaba antes:"
  decir "  sudo $0 $antes"
  volver_a_levantar
  morir "restauracion incompleta"
fi
rm -f "$registro"

# --- Comprobar que quedo algo coherente ----------------------------------

# Se consulta POR DONDE CONSULTA LA APLICACION, no como administrador de la
# base. Preguntando como 'postgres' una restauracion con los permisos mal
# puestos se ve perfecta, y el sistema no ve nada.
institucion="$(psql -tAc 'SELECT nombre FROM "Institucion" WHERE id=1' "$URL_PSQL" 2>/dev/null | sed 's/^ *//')"
alumnos="$(psql -tAc 'SELECT count(*) FROM "Alumno"' "$URL_PSQL" 2>/dev/null | tr -d ' ')"
usuarios="$(psql -tAc 'SELECT count(*) FROM "Usuario"' "$URL_PSQL" 2>/dev/null | tr -d ' ')"

if [[ -z "$institucion" ]]; then
  decir "ATENCION: los datos entraron pero el sistema no los alcanza."
  decir "Suele ser un problema de permisos en la base. Para volver atras:"
  decir "  sudo $0 $antes"
fi

volver_a_levantar

# Ultima comprobacion, la que de verdad cuenta: que el sistema reporte el
# colegio como instalado. Es lo que vera el personal al entrar.
if [[ "$detenido" == "1" ]]; then
  for intento in $(seq 1 20); do
    sleep 2
    salud="$(curl -fsS -m 5 "http://localhost:$PUERTO_SISTEMA/api/salud" 2>/dev/null || true)"
    [[ "$salud" == *'"instalado":true'* ]] && break
  done
  if [[ "${salud:-}" == *'"instalado":true'* ]]; then
    decir "el sistema ya responde con el colegio restaurado"
  else
    decir "AVISO: el sistema todavia no reporta el colegio. Revisa /api/salud."
  fi
fi

echo
echo "==================================================================="
echo " Restauracion terminada"
echo
echo "   Colegio:   ${institucion:-(sin institucion: revisa el archivo)}"
echo "   Alumnos:   ${alumnos:-?}"
echo "   Usuarios:  ${usuarios:-?}"
echo
echo " El estado anterior quedo guardado en:"
echo "   $antes"
echo
if [[ -n "${institucion:-}" ]]; then
  echo " Entra al sistema y revisa que la informacion sea la que esperabas"
  echo " antes de que el personal vuelva a capturar."
else
  echo " ATENCION: no aparecio la institucion. Puede que ese archivo no sea"
  echo " un respaldo de este sistema. Para volver atras:"
  echo "   sudo $0 $antes"
fi
echo "==================================================================="
