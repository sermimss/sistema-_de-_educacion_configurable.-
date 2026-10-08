#!/usr/bin/env node
// Descubridor de la red local del colegio.
//
//   node scripts/red-escolar.mjs buscar     -> busca vecinos y los imprime
//   node scripts/red-escolar.mjs anunciar   -> queda contestando a quien busque
//
// Variables que usa:
//   CLAVE_RED   clave compartida del colegio (obligatoria)
//   SITIO_ID    identificador de esta computadora (para anunciar)
//   PORT        puerto donde esta el sistema en esta computadora
//   MANDA       "1" si esta computadora tiene la base activa
//
// No usa ninguna dependencia externa a proposito: tiene que funcionar dentro
// del paquete instalable, sin internet y sin npm.

import dgram from "node:dgram";
import os from "node:os";
import { randomBytes } from "node:crypto";
import {
  PUERTO_DESCUBRIMIENTO,
  VERSION_PROTOCOLO,
  firmar,
  firmaValida,
  momentoFresco,
  camposAnuncio,
  camposSondeo,
} from "./protocolo-red.mjs";

const SISTEMA = "escolar";
const claveRed = process.env.CLAVE_RED || "";
if (!claveRed) {
  console.error("Falta CLAVE_RED: sin clave compartida no se puede confiar en los vecinos.");
  process.exit(2);
}

/// Direcciones de difusion de cada tarjeta de red. Mandar solo a
/// 255.255.255.255 no alcanza: hay redes y sistemas que lo descartan.
function difusiones() {
  const destinos = new Set(["255.255.255.255"]);
  for (const tarjetas of Object.values(os.networkInterfaces())) {
    for (const t of tarjetas || []) {
      if (t.family !== "IPv4" || t.internal) continue;
      if (!t.address || !t.netmask) continue;
      const ip = t.address.split(".").map(Number);
      const mascara = t.netmask.split(".").map(Number);
      destinos.add(ip.map((o, i) => (o & mascara[i]) | (~mascara[i] & 255)).join("."));
    }
  }
  return [...destinos];
}

async function buscar(ms) {
  const nonce = randomBytes(12).toString("hex");
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  const pares = new Map();

  socket.on("message", (datos, origen) => {
    let m;
    try { m = JSON.parse(datos.toString("utf8")); } catch { return; }
    if (m?.sistema !== SISTEMA || m?.tipo !== "aqui-estoy") return;
    if (m.v !== VERSION_PROTOCOLO) return;
    if (!momentoFresco(m.momento)) return;
    const anuncio = {
      sitio: String(m.sitio ?? ""),
      puerto: Number(m.puerto ?? 0),
      manda: Boolean(m.manda),
      instalado: Boolean(m.instalado),
      version: String(m.version ?? ""),
      momento: Number(m.momento),
    };
    // La firma prueba que el vecino conoce la clave del colegio. Sin esto,
    // cualquier aparato de la red podria decir que el tiene la base.
    if (!firmaValida(firmar(claveRed, camposAnuncio(anuncio, nonce)), m.firma)) return;
    if (!anuncio.sitio || !anuncio.puerto) return;
    pares.set(anuncio.sitio, { ...anuncio, direccion: origen.address });
  });

  await new Promise((listo) => socket.bind(listo));
  socket.setBroadcast(true);

  const momentoSondeo = Date.now();
  const sondeo = Buffer.from(JSON.stringify({
    sistema: SISTEMA, v: VERSION_PROTOCOLO, tipo: "busco",
    nonce, momento: momentoSondeo,
    firma: firmar(claveRed, camposSondeo(nonce, momentoSondeo)),
  }));

  // Se sondea tres veces: UDP se pierde sin avisar.
  for (let intento = 0; intento < 3; intento++) {
    for (const destino of difusiones()) {
      socket.send(sondeo, PUERTO_DESCUBRIMIENTO, destino, () => {});
    }
    await new Promise((r) => setTimeout(r, Math.max(120, Math.floor(ms / 4))));
  }
  await new Promise((r) => setTimeout(r, Math.max(200, Math.floor(ms / 4))));
  socket.close();

  const lista = [...pares.values()].sort((a, b) => a.sitio.localeCompare(b.sitio));
  console.log(JSON.stringify({ pares: lista }));
}

async function anunciar() {
  const sitio = process.env.SITIO_ID || "";
  // El resto del sistema usa PORT; PUERTO queda solo por compatibilidad. Si se
  // lee la variable equivocada, esta computadora anuncia un puerto donde no
  // hay nada y las demas no pueden sumarse a ella.
  const puerto = Number(process.env.PORT || process.env.PUERTO || 3000);
  const manda = process.env.MANDA === "1";
  if (!sitio) {
    console.error("Falta SITIO_ID.");
    process.exit(2);
  }

  // Si esta computadora ya tiene colegio cargado se pregunta al propio sistema,
  // en lugar de hablarle a la base: asi el descubridor no necesita credenciales.
  let instalado = false;
  let revisado = 0;
  async function revisarInstalado() {
    if (Date.now() - revisado < 15_000) return instalado;
    revisado = Date.now();
    try {
      const r = await fetch(`http://127.0.0.1:${puerto}/api/salud`, {
        signal: AbortSignal.timeout(2000),
      });
      instalado = Boolean((await r.json())?.instalado);
    } catch { /* el sistema puede estar arrancando todavia */ }
    return instalado;
  }

  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  socket.on("message", async (datos, origen) => {
    let m;
    try { m = JSON.parse(datos.toString("utf8")); } catch { return; }
    if (m?.sistema !== SISTEMA || m?.tipo !== "busco") return;
    if (m.v !== VERSION_PROTOCOLO) return;
    if (!momentoFresco(m.momento)) return;
    const nonce = String(m.nonce ?? "");
    if (!nonce) return;
    // Solo se contesta a quien comparte la clave del colegio.
    if (!firmaValida(firmar(claveRed, camposSondeo(nonce, Number(m.momento))), m.firma)) return;

    const anuncio = {
      sitio, puerto, manda,
      instalado: await revisarInstalado(),
      version: process.env.VERSION_SISTEMA || "0",
      momento: Date.now(),
    };
    const respuesta = Buffer.from(JSON.stringify({
      sistema: SISTEMA, v: VERSION_PROTOCOLO, tipo: "aqui-estoy",
      ...anuncio,
      firma: firmar(claveRed, camposAnuncio(anuncio, nonce)),
    }));
    socket.send(respuesta, origen.port, origen.address, () => {});
  });

  await new Promise((listo) => socket.bind(PUERTO_DESCUBRIMIENTO, listo));
  socket.setBroadcast(true);
  console.log(`[red] ${sitio} anunciandose en el puerto ${PUERTO_DESCUBRIMIENTO} (manda=${manda ? "si" : "no"})`);
}

const orden = process.argv[2];
const ms = Number((process.argv.find((a) => a.startsWith("--ms=")) || "").slice(5)) || 2500;

if (orden === "buscar") await buscar(ms);
else if (orden === "anunciar") await anunciar();
else {
  console.error("Uso: red-escolar.mjs buscar [--ms=2500] | anunciar");
  process.exit(2);
}
