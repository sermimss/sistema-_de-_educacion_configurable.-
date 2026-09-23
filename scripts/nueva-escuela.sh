#!/usr/bin/env bash
# Aprovisiona una instalacion nueva para un colegio.
#
# Dos modos:
#
#   ./scripts/nueva-escuela.sh colegio-vanguardia
#       Crea la base de datos local, aplica las migraciones y genera el
#       archivo de entorno .env.colegio-vanguardia
#
#   ./scripts/nueva-escuela.sh --render colegio-vanguardia
#       Genera render-colegio-vanguardia.yaml, el blueprint para desplegar
#       ese colegio en Render con su propia base de datos.
#
# En ambos casos el colegio termina de configurarse en el asistente de
# instalacion, que es donde define su nombre, niveles, materias, cobros y todo
# lo demas.

set -euo pipefail

MODO="local"
if [[ "${1:-}" == "--render" ]]; then
  MODO="render"
  shift
fi

CLAVE="${1:-}"
if [[ -z "$CLAVE" ]]; then
  echo "Uso: $0 [--render] <clave-del-colegio>   (solo minusculas, numeros y guiones)" >&2
  exit 1
fi
if [[ ! "$CLAVE" =~ ^[a-z0-9-]+$ ]]; then
  echo "La clave solo admite minusculas, numeros y guiones: $CLAVE" >&2
  exit 1
fi

if [[ "$MODO" == "render" ]]; then
  ARCHIVO="render-${CLAVE}.yaml"
  if [[ -f "$ARCHIVO" ]]; then
    echo "Ya existe $ARCHIVO. Borralo a mano si de verdad quieres rehacerlo." >&2
    exit 1
  fi

  # Mismo blueprint que render.yaml, con los nombres del colegio.
  sed \
    -e "s/name: sistema-escolar/name: escuela-${CLAVE}/" \
    -e "s/name: escuela-db/name: escuela-${CLAVE}-db/" \
    render.yaml > "$ARCHIVO"

  cat <<FIN

Listo: $ARCHIVO

Para desplegarlo:
  1. Sube este archivo al repositorio (git add $ARCHIVO && git commit && git push).
  2. En Render: New > Blueprint, elige el repositorio y apunta a $ARCHIVO.
  3. Render crea el servicio web "escuela-${CLAVE}" y su base
     "escuela-${CLAVE}-db", genera AUTH_SECRET y aplica las migraciones.
  4. Abre la URL que te de Render y completa el asistente de instalacion.

Antes de cargar datos reales, sube el servicio y la base a un plan de paga:
el plan gratuito duerme el servicio y la base caduca.
FIN
  exit 0
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
