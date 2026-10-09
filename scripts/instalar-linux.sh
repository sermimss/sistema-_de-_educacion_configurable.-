#!/usr/bin/env bash
# Instala el sistema escolar en esta computadora y lo deja corriendo solo.
#
#   sudo ./instalar-linux.sh
#
# Deja el sistema como servicio: arranca al prender la computadora y se
# reinicia solo si se cae. Los demas dispositivos del colegio entran desde su
# navegador a http://<ip-de-esta-computadora>:3000
#
# No necesita internet, salvo que falte Node o PostgreSQL.

set -euo pipefail

DESTINO="${DESTINO:-/opt/sistema-escolar}"
USUARIO="${USUARIO_SERVICIO:-escuela}"
PUERTO="${PUERTO:-3000}"
BASE="${BASE_DATOS:-escuela}"
paquete="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$EUID" -ne 0 ]]; then
  echo "Este instalador necesita permisos de administrador. Usa: sudo $0" >&2
  exit 1
fi

echo "==> Revisando requisitos"
if ! command -v node >/dev/null 2>&1; then
  echo "Falta Node.js. Instalalo (version 22 o mayor) y vuelve a correr esto." >&2
  echo "  Debian/Ubuntu:  apt install nodejs" >&2
  exit 1
fi
version_node="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$version_node" -lt 22 ]]; then
  echo "Node $version_node es muy viejo; hace falta 22 o mayor." >&2
  exit 1
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "Falta PostgreSQL. Instalalo y vuelve a correr esto." >&2
  echo "  Debian/Ubuntu:  apt install postgresql" >&2
  exit 1
fi
echo "    Node $(node -v), PostgreSQL presente"

echo "==> Preparando la base de datos '$BASE'"
clave_bd="$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 24)"
existe_rol="$(su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='escuela'\"" || true)"
if [[ "$existe_rol" != "1" ]]; then
  su postgres -c "psql -c \"CREATE USER escuela WITH PASSWORD '$clave_bd';\"" >/dev/null
  echo "    usuario de base de datos creado"
else
  su postgres -c "psql -c \"ALTER USER escuela WITH PASSWORD '$clave_bd';\"" >/dev/null
  echo "    usuario de base de datos ya existia; se actualizo su contrasena"
fi
existe_base="$(su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='$BASE'\"" || true)"
if [[ "$existe_base" != "1" ]]; then
  su postgres -c "createdb -O escuela $BASE"
  echo "    base '$BASE' creada"
else
  echo "    base '$BASE' ya existia; se conservan sus datos"
fi

echo "==> Abriendo la base a la red local del colegio"
# Para que las demas computadoras del colegio puedan trabajar contra esta base.
# Se abre solo a la red local; el detalle esta en abrir-base-a-la-red.sh.
if [[ -x "$paquete/abrir-base-a-la-red.sh" ]]; then
  "$paquete/abrir-base-a-la-red.sh" "$BASE" escuela || true
else
  echo "    AVISO: falta abrir-base-a-la-red.sh; queda solo para uso local."
fi

echo "==> Copiando archivos a $DESTINO"
id -u "$USUARIO" >/dev/null 2>&1 || useradd --system --home "$DESTINO" --shell /usr/sbin/nologin "$USUARIO"

# Se decide ANTES de copiar si esto es una instalacion nueva o una
# actualizacion. Si se mirara despues, un archivo 'entorno' que viniera dentro
# del paquete pasaria por configuracion previa del colegio y el sistema
# quedaria con las claves de otra instalacion.
actualizacion=0
previo=""
if [[ -f "$DESTINO/entorno" ]]; then
  actualizacion=1
  previo="$(mktemp)"
  cp "$DESTINO/entorno" "$previo"
fi

mkdir -p "$DESTINO"
cp -r "$paquete/." "$DESTINO/"
rm -f "$DESTINO/instalar-linux.sh" "$DESTINO/instalar-windows.ps1"

if [[ "$actualizacion" == "1" ]]; then
  # Actualizacion: se conserva la configuracion del colegio, solo cambia la
  # contrasena de la base, que se acaba de regenerar.
  cp "$previo" "$DESTINO/entorno"
  rm -f "$previo"
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://escuela:$clave_bd@localhost:5432/$BASE?schema=public|" "$DESTINO/entorno"
  echo "    se conservo la configuracion existente"
else
  secreto="$(head -c 48 /dev/urandom | base64 | tr -d '\n')"
  # Identificador de esta computadora dentro de la red del colegio.
  sitio="$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  # Clave compartida del colegio. La primera computadora la genera; en las
  # demas se pasa con CLAVE_RED=... para que se reconozcan entre si.
  clave_red="${CLAVE_RED:-$(head -c 24 /dev/urandom | base64 | tr -d '/+=\n' | head -c 24)}"
  cat > "$DESTINO/entorno" <<ENTORNO
DATABASE_URL=postgresql://escuela:$clave_bd@localhost:5432/$BASE?schema=public
AUTH_SECRET=$secreto
PORT=$PUERTO
SESSION_HORAS=12
SITIO_ID=$sitio
CLAVE_RED=$clave_red
ENTORNO
  echo "    archivo de configuracion creado"
fi

# Se lee del archivo para poder mostrarla al final, tanto en una instalacion
# nueva como en una actualizacion.
clave_red_actual="$(grep -E '^CLAVE_RED=' "$DESTINO/entorno" | cut -d= -f2- || true)"
chmod 600 "$DESTINO/entorno"
chown -R "$USUARIO":"$USUARIO" "$DESTINO"

echo "==> Programando el respaldo diario"
# El respaldo corre como administrador (necesita pg_dump y crear la base
# temporal de verificacion), no como el usuario del sistema.
cat > /etc/systemd/system/respaldo-escolar.service <<UNIDAD
[Unit]
Description=Respaldo verificado de la base del colegio
After=postgresql.service
Wants=postgresql.service

[Service]
Type=oneshot
WorkingDirectory=$DESTINO
ExecStart=$DESTINO/respaldar.sh
StandardOutput=journal
StandardError=journal
UNIDAD

cat > /etc/systemd/system/respaldo-escolar.timer <<TEMPORIZADOR
[Unit]
Description=Respaldo diario de la base del colegio

[Timer]
# A las 22:00. Si la computadora estaba apagada a esa hora, se hace en cuanto
# se prenda: un respaldo tarde sirve, uno que no se hizo no.
OnCalendar=*-*-* 22:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
TEMPORIZADOR

echo "==> Registrando el servicio"
cat > /etc/systemd/system/sistema-escolar.service <<UNIDAD
[Unit]
Description=Sistema de gestion escolar
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$USUARIO
WorkingDirectory=$DESTINO
ExecStart=$DESTINO/arrancar.sh
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIDAD

if ! systemctl daemon-reload 2>/dev/null; then
  echo
  echo "AVISO: esta computadora no usa systemd, asi que el sistema no quedo"
  echo "registrado para arrancar solo. Todo lo demas si quedo instalado."
  echo
  echo "Para levantarlo a mano:"
  echo "  sudo -u $USUARIO $DESTINO/arrancar.sh"
  echo
  echo "Y el respaldo, a mano o con cron:"
  echo "  sudo $DESTINO/respaldar.sh"
  echo
  exit 0
fi
systemctl enable sistema-escolar >/dev/null 2>&1
systemctl restart sistema-escolar
systemctl enable respaldo-escolar.timer >/dev/null 2>&1
systemctl start respaldo-escolar.timer >/dev/null 2>&1

echo "==> Esperando a que el sistema responda"
for intento in $(seq 1 30); do
  sleep 2
  if curl -fsS "http://localhost:$PUERTO/api/salud" >/dev/null 2>&1; then
    echo "    responde"
    break
  fi
done

ip_local="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "==================================================================="
echo " Sistema escolar instalado"
echo
echo " Desde esta computadora:        http://localhost:$PUERTO"
if [[ -n "${ip_local:-}" ]]; then
  echo " Desde el resto del colegio:    http://$ip_local:$PUERTO"
fi
echo
papel="$(curl -fsS -m 5 "http://localhost:$PUERTO/api/red/estado" 2>/dev/null || true)"
if [[ "$papel" == *'"manda":false'* ]]; then
  echo " Esta computadora se SUMO a otra instalacion del colegio que ya tenia"
  echo " los datos. Ambas muestran la misma informacion; su base local quedo"
  echo " en reposo. No hay que correr el asistente otra vez."
else
  echo " Esta computadora tiene la base activa del colegio."
  echo " Abre esa direccion y completa el asistente de instalacion."
fi
echo
echo " ---- Para instalar en otra computadora del colegio ----"
echo
echo " Clave de red del colegio:"
echo
echo "     ${clave_red_actual:-(no configurada)}"
echo
echo " Corre el instalador en la otra computadora pasandole esa clave:"
echo
echo "     sudo CLAVE_RED='${clave_red_actual:-...}' ./instalar-linux.sh"
echo
echo " Con la misma clave se reconocen entre si y se comportan como un solo"
echo " sistema: la que arranque primero guarda los datos y las demas trabajan"
echo " contra ella. Sin la clave, cada una quedaria como un colegio aparte."
echo " Guarda esa clave; es lo que impide que un aparato ajeno a la red se"
echo " haga pasar por el sistema del colegio."
echo
echo " ---- Respaldos ----"
echo
echo " Queda programado todos los dias a las 22:00, y se verifica a si mismo"
echo " restaurando la copia y comparando los datos."
echo
echo "     Carpeta:   ${RESPALDOS:-/var/respaldos-escolares}"
echo "     Ahora:     sudo $DESTINO/respaldar.sh"
echo "     Restaurar: sudo $DESTINO/restaurar.sh"
echo "     Ver:       systemctl list-timers respaldo-escolar.timer"
echo
echo " FALTA UN PASO, y es el importante: que la copia salga de esta"
echo " computadora. Conecta una USB o disco externo y agrega su ruta al"
echo " archivo $DESTINO/entorno:"
echo
echo "     RESPALDOS_EXTERNO=/media/usb-colegio"
echo
echo " Un respaldo en el mismo disco que los datos no protege de que ese"
echo " disco falle."
echo
echo " Para ver como va:     systemctl status sistema-escolar"
echo " Para ver el registro: journalctl -u sistema-escolar -f"
echo " Para detenerlo:       systemctl stop sistema-escolar"
echo "==================================================================="
