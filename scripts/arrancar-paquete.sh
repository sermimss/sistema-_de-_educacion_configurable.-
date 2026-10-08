#!/usr/bin/env bash
# Arranque del sistema ya instalado en la computadora del colegio.
#
# Cada instalacion trae su propia base de datos y puede trabajar sola. Pero si
# hay otras instalaciones del mismo colegio en la misma red, solo una base
# queda activa y las demas computadoras sirven el sistema contra esa: de otro
# modo se repetirian los folios de recibo y el mismo alumno tendria dos saldos.
#
# El papel no se configura a mano: se decide aqui, en cada arranque.

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
export SITIO_ID="${SITIO_ID:-}"
export CLAVE_RED="${CLAVE_RED:-}"
export VERSION_SISTEMA="$(cat VERSION 2>/dev/null || echo 0)"

PRISMA="node_modules/prisma/build/index.js"

# --- Que papel toca en esta red -------------------------------------------

papel="$(mktemp)"
trap 'rm -f "$papel"' EXIT

node scripts/elegir-papel.mjs "$papel"
eleccion=$?

if [[ "$eleccion" -ne 0 ]]; then
  # El unico caso que llega aqui: hay una base activa en la red que esta
  # computadora no alcanza. Arrancar con la base local partiria los datos en
  # dos, asi que no se arranca. El servicio reintentara solo.
  echo "[arranque] no se abre el sistema en esta computadora (ver mensajes de red)."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$papel"
set +a
export MANDA="${MANDA:-1}"
export SITIO_QUE_MANDA="${SITIO_QUE_MANDA:-}"

# --- Migraciones -----------------------------------------------------------

# Solo migra quien tiene la base activa. Si una computadora secundaria tambien
# migrara, dos procesos tocarian el esquema de la misma base a la vez.
if [[ "$MANDA" == "1" ]]; then
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
else
  echo "[arranque] la base la administra ${SITIO_QUE_MANDA}; aqui no se migra."
fi

# --- Anuncio en la red -----------------------------------------------------

anunciador=""
if [[ -n "$CLAVE_RED" && -n "$SITIO_ID" ]]; then
  node scripts/red-escolar.mjs anunciar &
  anunciador=$!
fi

echo "[arranque] sistema escolar escuchando en ${HOSTNAME}:${PORT} (manda=${MANDA})"

# No se usa 'exec' porque hay que llevarse el anuncio al cerrar: una
# computadora que ya no sirve el sistema no puede seguir diciendo que tiene la
# base, o las demas se quedarian esperandola. Las senales se reenvian a mano.
node server.js &
servidor=$!

limpiar() {
  [[ -n "$anunciador" ]] && kill "$anunciador" 2>/dev/null
  kill "$servidor" 2>/dev/null
  rm -f "$papel"
}
trap 'limpiar' EXIT
trap 'limpiar; exit 143' TERM
trap 'limpiar; exit 130' INT

wait "$servidor"
codigo=$?
echo "[arranque] el servidor termino con codigo $codigo"
exit "$codigo"
