#!/usr/bin/env bash
# Arma un paquete autocontenido del sistema, para instalarlo en una
# computadora del colegio sin necesidad de internet.
#
#   ./scripts/empaquetar.sh
#
# El resultado queda en dist/ y no requiere npm ni descargar nada en la
# maquina destino: lleva dentro el servidor compilado, sus dependencias, la
# herramienta de migraciones y el motor de base de datos de Prisma.
#
# IMPORTANTE: el motor de Prisma es propio de cada sistema operativo, asi que
# el paquete se arma en el mismo sistema donde se va a instalar: en Linux para
# instalar en Linux, en Windows para instalar en Windows.

set -euo pipefail

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$raiz"

VERSION="$(node -p "require('./package.json').version")"
SISTEMA="$(uname -s | tr '[:upper:]' '[:lower:]')"
DESTINO="dist/sistema-escolar"

echo "==> Compilando (esto tarda un poco)"
npm run build

echo "==> Armando el paquete en $DESTINO"
rm -rf dist
mkdir -p "$DESTINO"

# El servidor compilado ya trae sus dependencias de ejecucion.
cp -r .next/standalone/. "$DESTINO/"
mkdir -p "$DESTINO/.next"
cp -r .next/static "$DESTINO/.next/static"
cp -r public "$DESTINO/public"

# Esquema y migraciones: se aplican al instalar y en cada actualizacion.
mkdir -p "$DESTINO/prisma"
cp prisma/schema.prisma "$DESTINO/prisma/"
cp -r prisma/migrations "$DESTINO/prisma/"

# Herramienta de migraciones y motores, para no depender de internet.
# No se eligen a mano: se calcula el arbol completo de dependencias del CLI de
# Prisma, porque elegirlas a mano deja fuera dependencias indirectas y las
# migraciones fallan en la computadora del colegio.
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

# Next copia el .env del desarrollo dentro de standalone. Ese archivo trae la
# contrasena de la base y la clave de firma de sesiones de quien compila, asi
# que NO puede viajar al colegio: cada instalacion genera las suyas.
rm -f "$DESTINO"/.env "$DESTINO"/.env.*

cp scripts/arrancar-paquete.sh "$DESTINO/arrancar.sh"
chmod +x "$DESTINO/arrancar.sh"
cp scripts/instalar-linux.sh "$DESTINO/instalar-linux.sh"
chmod +x "$DESTINO/instalar-linux.sh"
cp scripts/instalar-windows.ps1 "$DESTINO/instalar-windows.ps1"
cp docs/instalacion-local.md "$DESTINO/LEEME.md"

echo "$VERSION" > "$DESTINO/VERSION"
echo "$SISTEMA" > "$DESTINO/SISTEMA"

echo "==> Revisando que no se vayan secretos en el paquete"
if find "$DESTINO" -maxdepth 2 -name ".env*" | grep -q .; then
  echo "ERROR: el paquete contiene archivos .env; se aborta." >&2
  find "$DESTINO" -maxdepth 2 -name ".env*" >&2
  exit 1
fi
echo "    limpio"

echo "==> Comprimiendo"
( cd dist && tar -czf "sistema-escolar-${VERSION}-${SISTEMA}.tar.gz" sistema-escolar )
if command -v zip >/dev/null 2>&1; then
  ( cd dist && zip -qr "sistema-escolar-${VERSION}-${SISTEMA}.zip" sistema-escolar )
fi

echo
echo "Listo:"
ls -lh dist/*.tar.gz dist/*.zip 2>/dev/null | awk '{print "  " $9 "  " $5}'
echo "  carpeta sin comprimir: $DESTINO ($(du -sh "$DESTINO" | cut -f1))"
