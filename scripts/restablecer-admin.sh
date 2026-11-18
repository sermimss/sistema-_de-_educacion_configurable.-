#!/usr/bin/env bash
# Recupera el acceso del administrador del colegio en esta computadora.
#   ./restablecer-admin.sh             elige de la lista
#   ./restablecer-admin.sh direccion   restablece esa cuenta
# Corre en la computadora donde esta la base (la principal si hay varias).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
if [[ -f entorno && ! -r entorno ]]; then
  echo "No se puede leer el archivo 'entorno'. Ejecutalo con sudo: sudo ./restablecer-admin.sh" >&2
  exit 1
fi
exec node scripts/restablecer-admin.mjs "$@"
