#!/usr/bin/env bash
# Arranque del sistema ya instalado en la computadora del colegio.
# Aplica las migraciones pendientes con la herramienta que viene dentro del
# paquete (sin internet) y levanta el servidor.

set -u
cd "$(dirname "${BASH_SOURCE[0]}")"

if [[ -f entorno ]]; then
  set -a
  # shellcheck disable=SC1091
  source entorno
  set +a
fi

: "${DATABASE_URL:?Falta DATABASE_URL en el archivo 'entorno'}"
: "${AUTH_SECRET:?Falta AUTH_SECRET en el archivo 'entorno'}"
export PORT="${PORT:-3000}"
# El servidor debe escuchar en todas las interfaces para que lo alcancen las
# demas computadoras del colegio. Se usa un nombre propio (ESCUCHAR_EN) porque
# HOSTNAME ya viene puesto por el sistema con el nombre de la maquina, y
# tomarlo de ahi deja al sistema visible solo desde el propio servidor.
export HOSTNAME="${ESCUCHAR_EN:-0.0.0.0}"

PRISMA="node_modules/prisma/build/index.js"
INTENTOS="${INTENTOS_MIGRACION:-3}"
aplicadas=0

for intento in $(seq 1 "$INTENTOS"); do
  echo "[arranque] aplicando migraciones (intento $intento de $INTENTOS)..."
  if node "$PRISMA" migrate deploy --schema prisma/schema.prisma; then
    aplicadas=1
    break
  fi
  if [[ "$intento" -lt "$INTENTOS" ]]; then
    espera=$((intento * 3))
    echo "[arranque] la base no respondio; reintento en ${espera}s"
    sleep "$espera"
  fi
done

if [[ "$aplicadas" != "1" ]]; then
  echo "[arranque] ADVERTENCIA: no se pudieron aplicar las migraciones."
  echo "[arranque] El servidor arranca igual; revisa /api/salud."
fi

echo "[arranque] sistema escolar escuchando en el puerto ${PORT}"
exec node server.js
