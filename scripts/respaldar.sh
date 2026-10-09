#!/usr/bin/env bash
# Respaldo de la base del colegio, con verificacion.
#
#   sudo ./respaldar.sh
#
# Hace tres cosas, y la tercera es la que importa:
#
#   1. Saca una copia de la base y la comprime.
#   2. Borra las copias mas viejas que los dias configurados.
#   3. RESTAURA la copia recien hecha en una base temporal y compara los
#      conteos con el original. Un respaldo que nunca se probo no es un
#      respaldo: es un archivo del que nadie sabe nada.
#
# Si algo falla sale con codigo distinto de cero, para que el sistema que lo
# programa (systemd o el Programador de tareas) lo reporte en lugar de que
# pase inadvertido durante meses.
#
# Variables (se leen del archivo 'entorno' junto a este script):
#   DATABASE_URL        de donde sacar la copia
#   RESPALDOS           carpeta destino        (por omision /var/respaldos-escolares)
#   RESPALDOS_DIAS      cuantos dias conservar (por omision 30)
#   RESPALDOS_EXTERNO   segunda copia fuera de esta computadora (USB, disco, red)
#   SIN_VERIFICAR=1     omite el paso 3 (no recomendado)

set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if [[ -f entorno ]]; then
  set -a
  # shellcheck disable=SC1091
  source entorno
  set +a
fi

DESTINO="${RESPALDOS:-/var/respaldos-escolares}"
DIAS="${RESPALDOS_DIAS:-30}"
EXTERNO="${RESPALDOS_EXTERNO:-}"
PUERTO_SISTEMA="${PORT:-3000}"

decir() { echo "[respaldo] $*"; }
morir() { echo "[respaldo] ERROR: $*" >&2; exit 1; }

if [[ "$EUID" -ne 0 ]]; then
  morir "necesita permisos de administrador. Usa: sudo $0"
fi
command -v su >/dev/null 2>&1 || morir "falta 'su'"

# --- De que base se saca la copia ------------------------------------------

[[ -n "${DATABASE_URL:-}" ]] || morir "falta DATABASE_URL en el archivo 'entorno'"

# El nombre de la base sale de la cadena de conexion, sin la contrasena.
BASE="$(printf '%s' "$DATABASE_URL" | sed -E 's|^[^/]*//[^/]*/||; s|\?.*$||')"
[[ -n "$BASE" ]] || morir "no se pudo leer el nombre de la base de DATABASE_URL"

# Si esta computadora se sumo a otra instalacion del colegio, los datos no son
# suyos: respaldarlos aqui tambien daria dos copias del mismo dia desde dos
# lugares, y confundiria a quien tenga que restaurar. Respalda quien manda.
papel="$(curl -fsS -m 5 "http://localhost:$PUERTO_SISTEMA/api/red/estado" 2>/dev/null || true)"
if [[ "$papel" == *'"manda":false'* ]]; then
  quien="$(printf '%s' "$papel" | sed -E 's/.*"sitioQueManda":"([^"]*)".*/\1/')"
  decir "esta computadora no guarda los datos (los administra ${quien:-otra})."
  decir "el respaldo se hace alla. Aqui no hay nada que copiar."
  exit 0
fi

# El sistema puede estar apagado, y entonces lo de arriba no dice nada. Asi que
# no se confia solo en eso: se mira la base misma. Una computadora secundaria
# tiene su base local vacia, y respaldarla daria un archivo de unos kilobytes
# que parece un respaldo correcto y no sirve para nada.
hay_colegio="$(su postgres -c "psql -tAc 'SELECT instalado FROM \"Institucion\" WHERE id=1' '$BASE'" 2>/dev/null | tr -d ' ')"
if [[ "$hay_colegio" != "t" ]]; then
  decir "la base '$BASE' de esta computadora no tiene ningun colegio cargado."
  decir "No se respalda: un archivo de una base vacia parece un respaldo"
  decir "correcto y no sirve para nada."
  if [[ -n "$papel" ]]; then
    decir "Si esta computadora se suma a otra del colegio, el respaldo va alla."
  else
    decir "Revisa que el sistema este corriendo y que el colegio este instalado."
  fi
  exit 0
fi

# --- 1. La copia -----------------------------------------------------------

mkdir -p "$DESTINO" || morir "no se pudo crear $DESTINO"
chmod 700 "$DESTINO"

sello="$(date +%Y-%m-%d_%H%M)"
archivo="$DESTINO/${BASE}-${sello}.sql.gz"

decir "copiando '$BASE' a $archivo"
if ! su postgres -c "pg_dump --no-owner --no-privileges '$BASE'" | gzip > "$archivo"; then
  rm -f "$archivo"
  morir "pg_dump fallo; no se dejo un archivo a medias"
fi
# pg_dump puede fallar despues de haber escrito algo: si el gzip quedo roto,
# el archivo es inservible y vale mas borrarlo que guardarlo.
if ! gzip -t "$archivo" 2>/dev/null; then
  rm -f "$archivo"
  morir "la copia quedo incompleta; se borro"
fi
chmod 600 "$archivo"

tamano="$(du -h "$archivo" | cut -f1)"
decir "copia lista ($tamano)"

# --- 2. Verificacion: restaurar y comparar ---------------------------------

if [[ "${SIN_VERIFICAR:-}" == "1" ]]; then
  decir "AVISO: verificacion omitida por configuracion."
else
  temporal="verificacion_respaldo_$$"
  decir "verificando: se restaura en una base temporal y se comparan los datos"

  limpiar_temporal() {
    su postgres -c "psql -tAc \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$temporal'\"" >/dev/null 2>&1
    su postgres -c "dropdb --if-exists '$temporal'" >/dev/null 2>&1
  }
  trap limpiar_temporal EXIT

  limpiar_temporal
  su postgres -c "createdb '$temporal'" >/dev/null 2>&1 \
    || morir "no se pudo crear la base temporal de verificacion"

  registro="$(mktemp)"
  if ! gunzip -c "$archivo" | su postgres -c "psql -q --set ON_ERROR_STOP=on '$temporal'" > "$registro" 2>&1; then
    decir "la restauracion de prueba fallo. Primeras lineas:"
    head -5 "$registro" >&2
    rm -f "$registro"
    morir "el respaldo NO sirve para restaurar. Revisa la base y vuelve a intentar."
  fi
  rm -f "$registro"

  # Se comparan los conteos de las tablas que importan. Si una sola difiere,
  # el respaldo no representa fielmente lo que hay en la base.
  diferencias=0
  for tabla in Institucion Usuario Alumno Empleado Cargo Pago Inscripcion CalificacionPeriodo RegistroAsistencia; do
    origen="$(su postgres -c "psql -tAc 'SELECT count(*) FROM \"$tabla\"' '$BASE'" 2>/dev/null | tr -d ' ')"
    copia="$(su postgres -c "psql -tAc 'SELECT count(*) FROM \"$tabla\"' '$temporal'" 2>/dev/null | tr -d ' ')"
    if [[ -z "$origen" || -z "$copia" ]]; then
      decir "  $tabla: no se pudo comparar"
      diferencias=$((diferencias + 1))
    elif [[ "$origen" != "$copia" ]]; then
      decir "  $tabla: original $origen, copia $copia  <-- NO COINCIDE"
      diferencias=$((diferencias + 1))
    else
      decir "  $tabla: $origen"
    fi
  done

  limpiar_temporal
  trap - EXIT

  if [[ "$diferencias" -ne 0 ]]; then
    morir "el respaldo no coincide con la base en $diferencias tabla(s). NO confies en el."
  fi
  decir "verificado: la copia restaura y coincide con la base"
fi

# --- 3. Segunda copia fuera de esta computadora ----------------------------

if [[ -n "$EXTERNO" ]]; then
  if [[ -d "$EXTERNO" ]] && touch "$EXTERNO/.escritura-de-prueba" 2>/dev/null; then
    rm -f "$EXTERNO/.escritura-de-prueba"
    if cp "$archivo" "$EXTERNO/"; then
      decir "copia tambien en $EXTERNO"
    else
      decir "AVISO: no se pudo copiar a $EXTERNO"
    fi
  else
    # Esto se avisa fuerte a proposito: es la falla silenciosa clasica. La USB
    # se desconecto hace meses, los respaldos siguen saliendo "bien", y el dia
    # que se quema la computadora no hay nada afuera.
    decir "AVISO IMPORTANTE: $EXTERNO no esta disponible."
    decir "El respaldo quedo SOLO en esta computadora. Si falla el disco, se"
    decir "pierde todo. Conecta el disco o la USB y vuelve a correr esto."
  fi
else
  decir "AVISO: no hay copia fuera de esta computadora (RESPALDOS_EXTERNO sin"
  decir "configurar). Un respaldo en el mismo disco que los datos no protege"
  decir "de que ese disco falle."
fi

# --- 4. Rotacion -----------------------------------------------------------

viejos="$(find "$DESTINO" -maxdepth 1 -name "${BASE}-*.sql.gz" -mtime "+$DIAS" | wc -l)"
if [[ "$viejos" -gt 0 ]]; then
  find "$DESTINO" -maxdepth 1 -name "${BASE}-*.sql.gz" -mtime "+$DIAS" -delete
  decir "se borraron $viejos respaldo(s) de mas de $DIAS dias"
fi

cuantos="$(find "$DESTINO" -maxdepth 1 -name "${BASE}-*.sql.gz" | wc -l)"
decir "listo. $cuantos respaldo(s) guardados en $DESTINO"
