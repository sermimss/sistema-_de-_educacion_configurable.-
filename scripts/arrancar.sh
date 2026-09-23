#!/usr/bin/env bash
# Arranque del servicio en produccion.
#
# Aplica las migraciones y levanta el servidor. Si la base todavia no responde
# (pasa en el primer despliegue, mientras el proveedor termina de crearla) se
# reintenta un par de veces y en el peor caso el servidor arranca igual:
# los reintentos son cortos a proposito, porque el hospedaje espera a que el
# proceso tome el puerto y un arranque lento se da por fallido.
# mas vale un sistema que responde y reporta el problema en /api/salud, que un
# proceso muerto devolviendo 502 sin decir por que.

set -u

INTENTOS="${INTENTOS_MIGRACION:-3}"
aplicadas=0

for intento in $(seq 1 "$INTENTOS"); do
  echo "[arranque] aplicando migraciones (intento $intento de $INTENTOS)..."
  if npx prisma migrate deploy; then
    aplicadas=1
    break
  fi
  # No tiene caso esperar despues del ultimo intento.
  if [[ "$intento" -lt "$INTENTOS" ]]; then
    espera=$((intento * 3))
    echo "[arranque] fallaron las migraciones; reintento en ${espera}s"
    sleep "$espera"
  fi
done

if [[ "$aplicadas" != "1" ]]; then
  echo "[arranque] ADVERTENCIA: no se pudieron aplicar las migraciones."
  echo "[arranque] El servidor arranca de todos modos. Revisa /api/salud y los"
  echo "[arranque] registros para ver si la base es alcanzable."
fi

echo "[arranque] levantando el servidor en el puerto ${PORT:-3000}"
exec node .next/standalone/server.js
