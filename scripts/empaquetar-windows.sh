#!/usr/bin/env bash
# Arma el paquete instalable de WINDOWS desde esta computadora con Linux.
#
#   ./scripts/empaquetar-windows.sh
#
# Asi el colegio no tiene que compilar nada: recibe un .zip, lo descomprime y
# corre el instalador. No necesita Node ni npm ni internet para instalar, solo
# Node y PostgreSQL ya puestos en la computadora.
#
# Por que se puede armar aqui:
#
#   - El servidor compilado de Next es JavaScript, igual en los dos sistemas.
#   - El motor de consultas de Prisma para Windows se descarga pidiendolo en
#     el esquema (binaryTargets), y ya viene en node_modules.
#   - El motor de migraciones de Windows se baja del sitio oficial de Prisma.
#   - Los binarios de 'sharp' que trae Next son solo de Linux, pero este
#     sistema no usa next/image ni sharp, asi que se excluyen.
#
# Lo que SI hay que probar en una computadora Windows de verdad: el
# Programador de tareas, el firewall y los permisos de archivo, que es lo que
# hace el instalador y no se puede ejecutar desde aqui.

set -euo pipefail

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$raiz"

VERSION="$(node -p "require('./package.json').version")"
DESTINO="dist-windows/sistema-escolar"
MOTORES="$(node -p "require('@prisma/engines-version').enginesVersion")"

echo "==> Compilando (esto tarda un poco)"
npm run build

echo "==> Armando el paquete en $DESTINO"
rm -rf dist-windows
mkdir -p "$DESTINO"

cp -r .next/standalone/. "$DESTINO/"
mkdir -p "$DESTINO/.next"
cp -r .next/static "$DESTINO/.next/static"
cp -r public "$DESTINO/public"

mkdir -p "$DESTINO/prisma"
cp prisma/schema.prisma "$DESTINO/prisma/"
cp -r prisma/migrations "$DESTINO/prisma/"

# Herramienta de migraciones y sus dependencias.
echo "==> Copiando la herramienta de migraciones y sus dependencias"
copiados=0
while IFS= read -r modulo; do
  [[ -n "$modulo" ]] || continue
  mkdir -p "$DESTINO/$(dirname "$modulo")"
  rm -rf "${DESTINO:?}/$modulo"
  cp -r "$modulo" "$DESTINO/$modulo"
  copiados=$((copiados + 1))
done < <(node scripts/cierre-dependencias.mjs "$raiz" prisma @prisma/engines)
echo "    $copiados paquetes"

# --- Cambio de plataforma: fuera lo de Linux, dentro lo de Windows --------

echo "==> Quitando los binarios de Linux"
# sharp solo lo usa next/image, que este sistema no usa. Son ~80 MB de
# binarios de Linux que en Windows no sirven de nada.
rm -rf "$DESTINO"/node_modules/@img
# Motores de consulta de Linux, en todas las copias que hace el empaquetado.
find "$DESTINO" -name "libquery_engine-*.so.node" -delete
find "$DESTINO" -name "schema-engine-debian*" -delete
find "$DESTINO" -name "schema-engine-linux*" -delete
find "$DESTINO" -name "schema-engine-rhel*" -delete

echo "==> Poniendo el motor de consultas de Windows"
motor_windows="node_modules/.prisma/client/query_engine-windows.dll.node"
if [[ ! -f "$motor_windows" ]]; then
  echo "ERROR: falta $motor_windows" >&2
  echo "Corre 'npx prisma generate' con binaryTargets incluyendo \"windows\"." >&2
  exit 1
fi
# Va junto al cliente generado, que es donde lo busca en tiempo de ejecucion.
for destino_cliente in "$DESTINO/node_modules/.prisma/client"; do
  mkdir -p "$destino_cliente"
  cp "$motor_windows" "$destino_cliente/"
done

echo "==> Bajando el motor de migraciones de Windows"
cache="$raiz/.cache-motores-windows"
mkdir -p "$cache"
exe="$cache/schema-engine-$MOTORES.exe"
if [[ ! -f "$exe" ]]; then
  url="https://binaries.prisma.sh/all_commits/$MOTORES/windows/schema-engine.exe.gz"
  echo "    desde $url"
  if ! curl -sSL --fail -m 900 -o "$exe.gz" "$url"; then
    echo "ERROR: no se pudo bajar el motor de migraciones de Windows." >&2
    exit 1
  fi
  gzip -t "$exe.gz" || { echo "ERROR: la descarga quedo dañada." >&2; rm -f "$exe.gz"; exit 1; }
  gunzip -c "$exe.gz" > "$exe"
  rm -f "$exe.gz"
fi

# Se comprueba que de verdad sea un ejecutable de Windows, no una pagina de
# error disfrazada de descarga.
if ! head -c 2 "$exe" | grep -q "^MZ"; then
  echo "ERROR: lo descargado no es un ejecutable de Windows." >&2
  rm -f "$exe"
  exit 1
fi

# Nombre que busca la herramienta de Prisma en Windows.
cp "$exe" "$DESTINO/node_modules/@prisma/engines/schema-engine-windows.exe"

# Los motores de Prisma vienen repetidos: el empaquetado los copia junto al
# cliente generado, junto a la herramienta y dentro de @prisma/engines. Solo
# hacen falta dos: el de consultas junto al cliente (lo usa el sistema al
# correr) y el de migraciones en @prisma/engines (lo usa la herramienta). Se
# comprobo quitando los demas: migra las 60 tablas y el sistema levanta igual.
rm -f "$DESTINO"/node_modules/prisma/query_engine-windows.dll.node
rm -f "$DESTINO"/node_modules/prisma/schema-engine-windows.exe
rm -f "$DESTINO"/node_modules/@prisma/engines/query_engine-windows.dll.node

# Next copia el .env del desarrollo dentro de standalone. Ese archivo trae la
# contrasena de la base y la clave de firma de sesiones de quien compila, asi
# que NO puede viajar al colegio: cada instalacion genera las suyas.
rm -f "$DESTINO"/.env "$DESTINO"/.env.*

# Scripts de la red local.
mkdir -p "$DESTINO/scripts"
cp scripts/protocolo-red.mjs scripts/red-escolar.mjs scripts/elegir-papel.mjs "$DESTINO/scripts/"

cp scripts/instalar-windows.ps1 "$DESTINO/instalar-windows.ps1"
cp scripts/respaldar-windows.ps1 "$DESTINO/respaldar-windows.ps1"
cp scripts/restaurar-windows.ps1 "$DESTINO/restaurar-windows.ps1"
cp scripts/diagnostico-windows.ps1 "$DESTINO/diagnostico-windows.ps1" 2>/dev/null || true
cp docs/instalacion-local.md "$DESTINO/LEEME.md"

echo "$VERSION" > "$DESTINO/VERSION"
echo "windows" > "$DESTINO/SISTEMA"

# --- Revisiones antes de entregar ----------------------------------------

echo "==> Revisando el paquete"

if find "$DESTINO" -maxdepth 2 -name ".env*" | grep -q .; then
  echo "ERROR: el paquete contiene archivos .env; se aborta." >&2
  exit 1
fi

sobrantes="$(find "$DESTINO" \( -name "*.so" -o -name "*.so.*" -o -name "*linux*" -o -name "*debian*" \) | wc -l)"
if [[ "$sobrantes" -gt 0 ]]; then
  echo "ERROR: quedaron $sobrantes archivo(s) de Linux en un paquete de Windows:" >&2
  find "$DESTINO" \( -name "*.so" -o -name "*.so.*" -o -name "*linux*" -o -name "*debian*" \) | head -10 >&2
  exit 1
fi

for necesario in \
  "server.js" \
  "node_modules/.prisma/client/query_engine-windows.dll.node" \
  "node_modules/@prisma/engines/schema-engine-windows.exe" \
  "node_modules/prisma/build/index.js" \
  "prisma/schema.prisma" \
  "instalar-windows.ps1" \
  "respaldar-windows.ps1" \
  "restaurar-windows.ps1" \
  "scripts/elegir-papel.mjs"
do
  if [[ ! -e "$DESTINO/$necesario" ]]; then
    echo "ERROR: falta $necesario en el paquete." >&2
    exit 1
  fi
done
echo "    limpio y completo"

echo "==> Comprimiendo"
if ! command -v zip >/dev/null 2>&1; then
  echo "ERROR: falta 'zip'. Instalalo: apt install zip" >&2
  exit 1
fi
( cd dist-windows && zip -qr "sistema-escolar-${VERSION}-windows.zip" sistema-escolar )

echo
echo "Listo:"
ls -lh dist-windows/*.zip | awk '{print "  " $9 "  " $5}'
echo "  carpeta sin comprimir: $DESTINO ($(du -sh "$DESTINO" | cut -f1))"
echo
echo "Este paquete se instala en Windows sin compilar nada."
echo "Requisitos en esa computadora: Node.js 22 o mayor y PostgreSQL 14 o mayor."
