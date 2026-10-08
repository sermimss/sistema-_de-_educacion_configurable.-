#!/usr/bin/env bash
# Permite que las demas computadoras del colegio trabajen contra esta base.
#
#   sudo ./abrir-base-a-la-red.sh <nombre-de-la-base> [usuario]
#
# Por omision PostgreSQL solo acepta conexiones de la propia computadora. Para
# que el resto del colegio pueda usar esta base hace falta abrirla, y aqui se
# abre con el menor alcance posible:
#
#   - solo a la red local a la que esta conectada esta computadora,
#   - solo para el usuario del sistema escolar,
#   - solo para esa base,
#   - siempre con contrasena (scram-sha-256).
#
# Nunca se abre a internet. Se guarda copia de los archivos originales con el
# sufijo .antes-del-sistema-escolar, y volver a correrlo no duplica nada.
#
# IMPORTANTE: esto asume que la red del colegio no es hostil. Quien este
# conectado a esa red y conozca la contrasena puede llegar a la base. Si el
# colegio comparte su WiFi con visitantes, la computadora de la base deberia
# estar en una red aparte.

set -euo pipefail

BASE="${1:?Falta el nombre de la base}"
USUARIO_BD="${2:-escuela}"

if [[ "$EUID" -ne 0 ]]; then
  echo "Necesita permisos de administrador. Usa: sudo $0 $*" >&2
  exit 1
fi

conf="$(su postgres -c "psql -tAc 'SHOW config_file'" 2>/dev/null | tr -d ' ' || true)"
hba="$(su postgres -c "psql -tAc 'SHOW hba_file'" 2>/dev/null | tr -d ' ' || true)"

if [[ -z "$conf" || -z "$hba" || ! -f "$conf" || ! -f "$hba" ]]; then
  echo "    AVISO: no se encontro la configuracion de PostgreSQL."
  echo "    El sistema funciona en esta computadora, pero las demas no podran"
  echo "    trabajar contra esta base hasta abrirla a mano."
  exit 0
fi

# Direccion y mascara de esta computadora. Se intenta con 'ip'; si no esta
# (hay instalaciones minimas de Linux sin iproute2) se recurre a 'hostname' y se
# asume la mascara mas comun de una red de oficina.
cidr=""
if command -v ip >/dev/null 2>&1; then
  cidr="$(ip -o -4 addr show scope global 2>/dev/null | awk '{print $4}' | head -1 || true)"
fi
if [[ -z "$cidr" ]]; then
  suelta="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  [[ -n "$suelta" ]] && cidr="$suelta/24"
fi
if [[ -z "$cidr" ]]; then
  echo "    AVISO: no se pudo determinar la red local de esta computadora."
  echo "    El sistema funciona aqui; para que las demas computadoras usen esta"
  echo "    base hay que abrirla a mano en PostgreSQL."
  exit 0
fi

# Direccion de red a partir de la direccion de la computadora y su mascara.
# Se permite la red completa, no una sola computadora, porque las demas pueden
# cambiar de direccion.
red="$(python3 -I -c "import ipaddress;print(ipaddress.ip_network('$cidr', strict=False))" 2>/dev/null || true)"
if [[ -z "$red" ]]; then
  echo "    AVISO: no se pudo calcular la red local; queda solo para uso local."
  exit 0
fi

cambios=0
hace_falta_reiniciar=0

if ! grep -qE "^[[:space:]]*listen_addresses[[:space:]]*=[[:space:]]*'\*'" "$conf"; then
  [[ -f "$conf.antes-del-sistema-escolar" ]] || cp "$conf" "$conf.antes-del-sistema-escolar"
  if grep -qE "^[[:space:]]*#?[[:space:]]*listen_addresses" "$conf"; then
    sed -i "s|^[[:space:]]*#\?[[:space:]]*listen_addresses.*|listen_addresses = '*'  # sistema escolar|" "$conf"
  else
    printf "listen_addresses = '*'  # sistema escolar\n" >> "$conf"
  fi
  echo "    PostgreSQL ahora escucha en la red"
  cambios=1
  # Este parametro NO se toma con una recarga: hace falta reiniciar el motor.
  hace_falta_reiniciar=1
fi

marca="# sistema escolar: red local del colegio"
if grep -qF "$marca" "$hba"; then
  echo "    el permiso de red ya estaba puesto"
else
  [[ -f "$hba.antes-del-sistema-escolar" ]] || cp "$hba" "$hba.antes-del-sistema-escolar"
  printf '\n%s\nhost %s %s %s scram-sha-256\n' "$marca" "$BASE" "$USUARIO_BD" "$red" >> "$hba"
  echo "    acceso permitido desde $red (solo usuario '$USUARIO_BD', solo base '$BASE')"
  cambios=1
fi

escuchando() {
  su postgres -c "psql -tAc 'SHOW listen_addresses'" 2>/dev/null | tr -d ' ' || true
}

# La decision de reiniciar se toma por lo que el motor tiene CARGADO, no por lo
# que diga el archivo: si una corrida anterior dejo el archivo correcto pero no
# reinicio, el archivo ya se ve bien y el motor sigue cerrado a la red.
if [[ "$(escuchando)" != "*" ]]; then
  hace_falta_reiniciar=1
fi

if [[ "$hace_falta_reiniciar" == "1" ]]; then
  # Reiniciar corta las conexiones abiertas. Se hace aqui, durante la
  # instalacion, justo porque es el momento en que nadie esta trabajando.
  if systemctl restart postgresql 2>/dev/null \
    || service postgresql restart >/dev/null 2>&1 \
    || pg_ctlcluster "$(ls /etc/postgresql 2>/dev/null | head -1)" main restart 2>/dev/null; then
    echo "    PostgreSQL reiniciado"
  else
    echo "    IMPORTANTE: reinicia PostgreSQL para que acepte conexiones de la red."
  fi
elif [[ "$cambios" == "1" ]]; then
  systemctl reload postgresql 2>/dev/null \
    || service postgresql reload >/dev/null 2>&1 \
    || su postgres -c "pg_ctl reload" 2>/dev/null \
    || echo "    recuerda recargar PostgreSQL para que tome el cambio"
fi

# Se comprueba de verdad, en lugar de dar por hecho que el cambio tomo efecto.
escucha="$(escuchando)"
if [[ "$escucha" == "*" ]]; then
  echo "    comprobado: la base acepta conexiones de la red"
else
  echo "    AVISO: la base sigue escuchando solo en '$escucha'."
  echo "    Las demas computadoras no podran usarla hasta reiniciar PostgreSQL."
fi
