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
  cat > "$DESTINO/entorno" <<ENTORNO
DATABASE_URL=postgresql://escuela:$clave_bd@localhost:5432/$BASE?schema=public
AUTH_SECRET=$secreto
PORT=$PUERTO
SESSION_HORAS=12
ENTORNO
  echo "    archivo de configuracion creado"
fi
chmod 600 "$DESTINO/entorno"
chown -R "$USUARIO":"$USUARIO" "$DESTINO"

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
  exit 0
fi
systemctl enable sistema-escolar >/dev/null 2>&1
systemctl restart sistema-escolar

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
echo " Abre esa direccion y completa el asistente de instalacion."
echo
echo " Para ver como va:     systemctl status sistema-escolar"
echo " Para ver el registro: journalctl -u sistema-escolar -f"
echo " Para detenerlo:       systemctl stop sistema-escolar"
echo "==================================================================="
