#!/usr/bin/env node
// Decide, al arrancar, si esta computadora manda (usa su propia base) o si se
// suma a una instalacion que ya esta trabajando en la misma red.
//
//   node scripts/elegir-papel.mjs <archivo-de-salida>
//
// Escribe en ese archivo, en formato que la consola puede leer con 'source':
//   MANDA=1|0
//   DATABASE_URL=...        (solo cuando se suma a otra computadora)
//   SITIO_QUE_MANDA=...
//
// Sin CLAVE_RED no hay red: la computadora trabaja sola con su base, que es
// exactamente el comportamiento de una instalacion unica.

import { writeFileSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { firmar, firmaValida, camposCredenciales } from "./protocolo-red.mjs";

const salida = process.argv[2];
if (!salida) {
  console.error("Uso: elegir-papel.mjs <archivo-de-salida>");
  process.exit(2);
}

const aqui = path.dirname(fileURLToPath(import.meta.url));
const claveRed = process.env.CLAVE_RED || "";
const sitio = process.env.SITIO_ID || "";

function escribir(lineas) {
  writeFileSync(salida, lineas.map((l) => `${l}\n`).join(""), { mode: 0o600 });
}

function sola(motivo) {
  console.log(`[red] ${motivo}: esta computadora trabaja con su propia base.`);
  escribir(["MANDA=1", `SITIO_QUE_MANDA=${sitio}`]);
  process.exit(0);
}

if (!claveRed) sola("sin clave de red");
if (!sitio) sola("sin identificador de sitio");

function buscar(ms) {
  try {
    const crudo = execFileSync(process.execPath, [path.join(aqui, "red-escolar.mjs"), "buscar", `--ms=${ms}`], {
      env: { ...process.env, CLAVE_RED: claveRed },
      encoding: "utf8",
      timeout: ms + 15_000,
    });
    return (JSON.parse(crudo).pares || []).filter((p) => p.sitio !== sitio);
  } catch (e) {
    console.log(`[red] no se pudo sondear la red (${e.code || e.message}); se sigue en solitario.`);
    return [];
  }
}

async function pedirCredenciales(par) {
  const momento = Date.now();
  const nonce = randomBytes(16).toString("hex");
  const cuerpo = {
    sitio,
    momento,
    nonce,
    firma: firmar(claveRed, camposCredenciales(sitio, momento, nonce)),
  };
  const r = await fetch(`http://${par.direccion}:${par.puerto}/api/red/credenciales`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`respondio ${r.status}`);
  const d = await r.json();
  // Se comprueba que quien contesta tambien conoce la clave: de otro modo un
  // intermediario podria devolver la direccion de una base falsa.
  if (!firmaValida(firmar(claveRed, ["respuesta", nonce, d.base, d.puerto]), d.firmaRespuesta)) {
    throw new Error("la respuesta no viene firmada con la clave del colegio");
  }
  const usuario = encodeURIComponent(String(d.usuario));
  const clave = encodeURIComponent(String(d.clave));
  const cola = d.parametros ? `?${d.parametros}` : "";
  return {
    url: `postgresql://${usuario}:${clave}@${par.direccion}:${d.puerto}/${d.base}${cola}`,
    sitioQueManda: String(d.sitioQueManda || par.sitio),
  };
}

async function sumarse(par) {
  const { url, sitioQueManda } = await pedirCredenciales(par);
  console.log(`[red] ya hay una base activa en ${par.direccion} (sitio ${sitioQueManda}).`);
  console.log("[red] esta computadora se suma a esa instalacion; su base local queda en reposo.");
  escribir([
    "MANDA=0",
    `DATABASE_URL=${url}`,
    `SITIO_QUE_MANDA=${sitioQueManda}`,
  ]);
}

// --- Eleccion -------------------------------------------------------------

let pares = buscar(2500);
let mandan = pares.filter((p) => p.manda);

if (mandan.length === 0) {
  // Nadie manda todavia. Si dos computadoras arrancan al mismo tiempo, las dos
  // llegarian aqui y las dos tomarian su base: dos sistemas escribiendo en
  // paralelo. Para evitarlo cada una espera un lapso propio, derivado de su
  // identificador, y vuelve a mirar. La que espera menos se queda con la base y
  // la otra ya la ve anunciada.
  const espera = (createHash("sha256").update(sitio).digest()[0] / 255) * 3000;
  console.log(`[red] nadie tiene la base activa; se confirma en ${Math.round(espera)} ms`);
  await new Promise((r) => setTimeout(r, espera));
  pares = buscar(1500);
  mandan = pares.filter((p) => p.manda);
}

if (mandan.length === 0) {
  sola("no hay otra instalacion en la red");
}

// Si por alguna razon hay mas de una, se toma la de identificador menor: el
// criterio es el mismo en todas las computadoras, asi que todas eligen igual.
mandan.sort((a, b) => a.sitio.localeCompare(b.sitio));

// Se insiste un poco: el vecino puede estar reiniciandose justo ahora.
for (let intento = 1; intento <= 3; intento++) {
  for (const par of mandan) {
    try {
      await sumarse(par);
      process.exit(0);
    } catch (e) {
      // "fetch failed" por si solo no dice nada a quien tenga que arreglarlo:
      // se agrega la causa (conexion rechazada, sin ruta, tiempo agotado...).
      const causa = e?.cause?.code || e?.cause?.message || "";
      const detalle = causa ? `${e.message} (${causa})` : e.message;
      console.log(`[red] intento ${intento}: no se pudo usar la base de ${par.direccion}:${par.puerto}: ${detalle}`);
    }
  }
  if (intento < 3) await new Promise((r) => setTimeout(r, intento * 3000));
}

// Aqui NO se toma la base local. Un vecino firmo con la clave del colegio y
// dijo que el tiene la base activa; esta computadora no lo alcanza, pero el
// resto del colegio probablemente si. Si tomara su propia base habria dos
// sistemas cobrando a la vez, con folios repetidos y saldos distintos para el
// mismo alumno. Mas vale que esta computadora no abra.
console.log("[red] hay una base activa en la red que esta computadora no alcanza.");
console.log("[red] no se abre el sistema aqui para no partir los datos en dos.");
console.log("[red] revisa la red o apaga la otra instalacion; se reintenta en cada arranque.");
escribir(["MANDA=0", "RED_SIN_ALCANCE=1", `SITIO_QUE_MANDA=${mandan[0].sitio}`]);
process.exit(3);
