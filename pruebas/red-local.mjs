// Pruebas de la red local del colegio.
//
// Necesita DOS instalaciones corriendo, con la misma clave de red:
//
//   A_PRUEBAS=http://localhost:3401   (la que tiene la base activa)
//   B_PRUEBAS=http://localhost:3402   (la que se sumo a la anterior)
//   CLAVE_RED=...                     (la clave compartida de las dos)
//
// Comprueba lo que de verdad importa: que las dos computadoras muestren los
// mismos datos, que lo que se escribe en una aparezca en la otra, y que un
// aparato sin la clave del colegio no pueda sacar las credenciales de la base.

import { chromium } from "playwright";
import { randomBytes } from "node:crypto";
import { firmar, camposCredenciales } from "../scripts/protocolo-red.mjs";

const A = process.env.A_PRUEBAS ?? "http://localhost:3401";
const B = process.env.B_PRUEBAS ?? "http://localhost:3402";
const CLAVE = process.env.CLAVE_RED ?? "";
const USUARIO = process.env.USUARIO_PRUEBAS ?? "direccion";
const CONTRASENA = process.env.CONTRASENA_PRUEBAS ?? "Vanguardia2026";

const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}

if (!CLAVE) {
  console.error("Falta CLAVE_RED.");
  process.exit(2);
}

// --- Las dos implementaciones del protocolo deben firmar igual -------------

// El sistema (TypeScript) y el descubridor (mjs) tienen cada uno su copia de
// las primitivas de firma, porque el descubridor corre como proceso aparte. Si
// se separaran, las computadoras dejarian de reconocerse y nadie sabria por que.
{
  const { execFileSync } = await import("node:child_process");
  const guion = `
import { firmar, camposAnuncio, camposCredenciales, camposSondeo } from "./src/lib/red";
const a = { sitio: "s1", puerto: 3000, manda: true, instalado: false, version: "1.0", momento: 1000 };
console.log(JSON.stringify({
  anuncio: firmar("k", camposAnuncio(a, "nn")),
  credenciales: firmar("k", camposCredenciales("s1", 1000, "nn")),
  sondeo: firmar("k", camposSondeo("nn", 1000)),
}));
`;
  let desdeTs = null;
  try {
    const salida = execFileSync("npx", ["tsx", "--eval", guion], {
      cwd: new URL("..", import.meta.url).pathname,
      encoding: "utf8",
      timeout: 120_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    desdeTs = JSON.parse(salida.trim().split("\n").pop());
  } catch (e) {
    comprobar("Se puede ejecutar la version TypeScript del protocolo", false, e.message.slice(0, 120));
  }

  if (desdeTs) {
    const { camposSondeo } = await import("../scripts/protocolo-red.mjs");
    const a = { sitio: "s1", puerto: 3000, manda: true, instalado: false, version: "1.0", momento: 1000 };
    const desdeMjs = {
      anuncio: firmar("k", (await import("../scripts/protocolo-red.mjs")).camposAnuncio(a, "nn")),
      credenciales: firmar("k", camposCredenciales("s1", 1000, "nn")),
      sondeo: firmar("k", camposSondeo("nn", 1000)),
    };
    for (const cual of ["anuncio", "credenciales", "sondeo"]) {
      comprobar(`Las dos implementaciones firman igual: ${cual}`,
        desdeTs[cual] === desdeMjs[cual],
        desdeTs[cual] === desdeMjs[cual] ? "" : `ts=${desdeTs[cual]?.slice(0, 12)} mjs=${desdeMjs[cual]?.slice(0, 12)}`);
    }
  }
}

// --- Papeles ---------------------------------------------------------------

const estadoA = await (await fetch(`${A}/api/red/estado`)).json();
const estadoB = await (await fetch(`${B}/api/red/estado`)).json();

comprobar("A tiene la base activa", estadoA.manda === true, JSON.stringify(estadoA));
comprobar("B no tiene la base activa", estadoB.manda === false, JSON.stringify(estadoB));
comprobar("B sabe quien manda", estadoB.sitioQueManda === estadoA.sitio,
  `${estadoB.sitioQueManda} vs ${estadoA.sitio}`);
comprobar("Las dos tienen la red configurada",
  estadoA.redConfigurada === true && estadoB.redConfigurada === true);

const saludA = await (await fetch(`${A}/api/salud`)).json();
const saludB = await (await fetch(`${B}/api/salud`)).json();
comprobar("Las dos alcanzan la base", saludA.baseDeDatos === "ok" && saludB.baseDeDatos === "ok");
comprobar("Las dos ven el colegio instalado", saludA.instalado === true && saludB.instalado === true);

// --- Credenciales: quien puede y quien no ----------------------------------

async function pedirCredenciales(base, clave, { nonce, momento } = {}) {
  const n = nonce ?? randomBytes(16).toString("hex");
  const m = momento ?? Date.now();
  const sitio = "prueba-externa";
  const r = await fetch(`${base}/api/red/credenciales`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sitio, momento: m, nonce: n, firma: firmar(clave, camposCredenciales(sitio, m, n)) }),
  });
  return { estado: r.status, cuerpo: await r.json().catch(() => ({})), nonce: n, momento: m };
}

const conClave = await pedirCredenciales(A, CLAVE);
comprobar("Con la clave del colegio se obtienen las credenciales", conClave.estado === 200,
  String(conClave.estado));
comprobar("Las credenciales traen la base y el usuario",
  Boolean(conClave.cuerpo.base) && Boolean(conClave.cuerpo.usuario));
comprobar("Las credenciales NO viajan con la direccion dentro",
  conClave.cuerpo.direccion === undefined && conClave.cuerpo.host === undefined);

const sinClave = await pedirCredenciales(A, "clave-de-un-aparato-ajeno");
comprobar("Sin la clave del colegio se rechaza", sinClave.estado === 403, String(sinClave.estado));
comprobar("El rechazo no filtra nada de la base",
  !JSON.stringify(sinClave.cuerpo).includes("postgres") && sinClave.cuerpo.clave === undefined);

const repetida = await pedirCredenciales(A, CLAVE, { nonce: conClave.nonce, momento: conClave.momento });
comprobar("Una peticion repetida se rechaza", repetida.estado === 409, String(repetida.estado));

const vieja = await pedirCredenciales(A, CLAVE, { momento: Date.now() - 10 * 60 * 1000 });
comprobar("Una peticion vencida se rechaza", vieja.estado === 400, String(vieja.estado));

const aB = await pedirCredenciales(B, CLAVE);
comprobar("La computadora que no manda no reparte credenciales", aB.estado === 409, String(aB.estado));

// --- Las dos muestran lo mismo, y lo escrito en una se ve en la otra -------

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function entrar(base) {
  const p = await navegador.newPage();
  p.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));
  await p.goto(`${base}/acceso`);
  await p.getByLabel("Usuario, matricula o correo").fill(USUARIO);
  await p.getByLabel("Contrasena").fill(CONTRASENA);
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.waitForURL("**/panel", { timeout: 20000 });
  return p;
}

const pa = await entrar(A);
const pb = await entrar(B);
comprobar("Se entra con la misma cuenta en las dos computadoras", true);

const nombreA = (await pa.textContent("body")).includes("Instituto Vanguardia");
const nombreB = (await pb.textContent("body")).includes("Instituto Vanguardia");
comprobar("Las dos muestran el mismo colegio", nombreA && nombreB);

// Se da de alta un concepto de cobro en B y se busca en A: si aparece, las dos
// estan trabajando sobre los mismos datos y no sobre copias separadas.
const marca = `Cuota de red ${randomBytes(3).toString("hex")}`;
await pb.goto(`${B}/panel/finanzas/conceptos`);
const cuerpoConceptos = await pb.textContent("body");
comprobar("B abre la pantalla de conceptos de cobro",
  cuerpoConceptos.includes("Concepto") || cuerpoConceptos.includes("concepto"));

// Se usan los nombres de campo y no las etiquetas: las etiquetas cambian con
// la redaccion de la pantalla y la prueba se caeria por un motivo que no es.
const clave = `RED${randomBytes(2).toString("hex").toUpperCase()}`;
await pb.locator('input[name="clave"]').first().fill(clave);
await pb.locator('input[name="nombre"]').first().fill(marca);
await pb.locator('input[name="montoBase"]').first().fill("150");
await pb.getByRole("button", { name: "Crear concepto" }).click();
await pb.waitForTimeout(2000);

await pb.goto(`${B}/panel/finanzas/conceptos`);
comprobar("El concepto quedo guardado desde B",
  (await pb.textContent("body")).includes(marca), marca);

await pa.goto(`${A}/panel/finanzas/conceptos`);
comprobar("Lo dado de alta en B se ve en A",
  (await pa.textContent("body")).includes(marca), marca);

await navegador.close();

console.log();
if (fallos.length) {
  console.log(`FALLARON ${fallos.length}:`);
  for (const f of fallos) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("TODAS LAS PRUEBAS DE RED LOCAL PASARON");
