#!/usr/bin/env bash
# Aprovisiona una instalacion nueva para un colegio: crea su base de datos,
# aplica las migraciones y genera su archivo de entorno.
#
#   ./scripts/nueva-escuela.sh colegio-vanguardia
#
# Despues basta con levantar la aplicacion apuntando a ese .env y entrar al
# asistente de instalacion, que es donde el colegio define todo lo suyo.

set -euo pipefail

CLAVE="${1:-}"
if [[ -z "$CLAVE" ]]; then
  echo "Uso: $0 <clave-del-colegio>   (solo letras, numeros y guiones)" >&2
  exit 1
fi
if [[ ! "$CLAVE" =~ ^[a-z0-9-]+$ ]]; then
  echo "La clave solo admite minusculas, numeros y guiones: $CLAVE" >&2
  exit 1
fi

BASE="escuela_${CLAVE//-/_}"
HOST="${PGHOST:-localhost}"
PUERTO="${PGPORT:-5432}"
USUARIO="${PGUSER:-escuela}"
CLAVE_BD="${PGPASSWORD:-escuela}"
ARCHIVO_ENV=".env.${CLAVE}"

if [[ -f "$ARCHIVO_ENV" ]]; then
  echo "Ya existe $ARCHIVO_ENV. Borralo a mano si de verdad quieres rehacerlo." >&2
  exit 1
fi

echo "Creando base de datos $BASE..."
PGPASSWORD="$CLAVE_BD" createdb -h "$HOST" -p "$PUERTO" -U "$USUARIO" "$BASE"

URL="postgresql://${USUARIO}:${CLAVE_BD}@${HOST}:${PUERTO}/${BASE}?schema=public"
SECRETO="$(openssl rand -base64 48 | tr -d '\n')"

cat > "$ARCHIVO_ENV" <<ENV
# Entorno del colegio: $CLAVE
DATABASE_URL="$URL"
AUTH_SECRET="$SECRETO"
SESSION_HORAS="12"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV
chmod 600 "$ARCHIVO_ENV"

echo "Aplicando migraciones..."
DATABASE_URL="$URL" npx prisma migrate deploy

echo
echo "Listo. El colegio '$CLAVE' tiene su base y su entorno en $ARCHIVO_ENV"
echo "Para levantarlo:"
echo "  env \$(grep -v '^#' $ARCHIVO_ENV | xargs) npm start"
echo "Luego abre el sistema y completa el asistente de instalacion."
