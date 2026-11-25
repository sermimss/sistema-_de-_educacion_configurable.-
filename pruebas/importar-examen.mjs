import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

// Cargar un examen ya escrito (texto pegado, .txt o .docx de Word) con vista
// previa y confirmacion. Requiere una base recien sembrada con los datos de
// demostracion y DATABASE_URL de esa base.

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const db = new PrismaClient();
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const texto = async (p) => (await p.locator("main").innerText()).replace(/\s+/g, " ");

// ---------------- Archivos de prueba ----------------
const carpeta = mkdtempSync(path.join(tmpdir(), "examenes-"));

/// Un .docx minimo: un ZIP con word/document.xml (comprimido, como Word).
function docx(parrafos) {
  const cuerpo = parrafos
    .map(([nivel, t]) =>
      `<w:p><w:pPr>${nivel == null ? "" : `<w:numPr><w:ilvl w:val="${nivel}"/><w:numId w:val="1"/></w:numPr>`}</w:pPr><w:r><w:t xml:space="preserve">${t.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t></w:r></w:p>`
    )
    .join("");
  const xml = Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${cuerpo}</w:body></w:document>`);
  const archivos = [
    ["[Content_Types].xml", Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')],
    ["word/document.xml", xml],
  ];
  const locales = [];
  const centrales = [];
  let offset = 0;
  for (const [nombre, datos] of archivos) {
    const comprimido = deflateRawSync(datos);
    const n = Buffer.from(nombre);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(datos), 14); local.writeUInt32LE(comprimido.length, 18); local.writeUInt32LE(datos.length, 22); local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(datos), 16); central.writeUInt32LE(comprimido.length, 20); central.writeUInt32LE(datos.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42);
    locales.push(local, n, comprimido);
    centrales.push(central, n);
    offset += 30 + n.length + comprimido.length;
  }
  const dir = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(archivos.length, 8); fin.writeUInt16LE(archivos.length, 10); fin.writeUInt32LE(dir.length, 12); fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locales, dir, fin]);
}
const rutaDocx = path.join(carpeta, "Examen de Word.docx");
writeFileSync(
  rutaDocx,
  docx([
    [null, "Segundo parcial — Matemáticas"],
    [0, "¿Cuál es el resultado de 3 × 3? (3 puntos)"],
    [1, "6"],
    [1, "*9"],
    [1, "12"],
    [0, "La raíz cuadrada de 16 es 4."],
    [null, "Respuesta: Verdadero"],
  ])
);
const rutaAnsi = path.join(carpeta, "examen-bloc-de-notas.txt");
writeFileSync(rutaAnsi, Buffer.from("1. ¿Qué número es par?\na) 3\n*b) 4\n", "latin1"));
const rutaPdf = path.join(carpeta, "examen.pdf");
writeFileSync(rutaPdf, "%PDF-1.4 no se lee");

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function entrar(usuario) {
  const p = await (await navegador.newContext()).newPage();
  p.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));
  await p.goto(`${BASE}/acceso`);
  await p.getByLabel(/^Usuario, matricula o correo\*?$/).fill(usuario);
  await p.getByLabel(/^Contrasena\*?$/).fill("Demo1234");
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.waitForURL("**/panel", { timeout: 20000 });
  return p;
}
const docente = await entrar("docente");
const mat = (await db.clase.findMany({ include: { planMateria: { include: { materia: true } } } })).find((c) => c.planMateria.materia.nombre === "Matematicas I");
const examen = await db.examen.create({
  data: { claseId: mat.id, titulo: "Examen cargado", abreEn: new Date(Date.now() - 60000), cierraEn: new Date(Date.now() + 86400000) },
});
const preguntas = () => db.preguntaExamen.findMany({ where: { examenId: examen.id }, include: { opciones: { orderBy: { orden: "asc" } } }, orderBy: { orden: "asc" } });

await docente.goto(`${BASE}/panel/examenes/${examen.id}`);
const caja = docente.locator("[data-importar-examen]");
comprobar("El editor del examen ofrece cargar un examen ya escrito", await caja.isVisible());
async function vistaPrevia({ escrito, archivo }) {
  if (escrito != null) await caja.getByLabel("Texto del examen").fill(escrito);
  if (archivo) await caja.locator('input[type="file"]').setInputFiles(archivo);
  await caja.getByRole("button", { name: "Ver vista previa" }).click();
  await docente.waitForTimeout(500);
  await caja.getByRole("button", { name: "Ver vista previa" }).waitFor({ timeout: 15000 });
  await docente.waitForTimeout(700);
}

// ---------------- Con errores no se agrega nada ----------------
await vistaPrevia({ escrito: "Parcial\n1. Sin correcta\na) uno\nb) dos\n2. Bien\n*a) si\nb) no\n3. Rara\nRespuesta: quizas" });
const errores = await caja.locator("[data-errores-importacion] li").allInnerTexts();
comprobar("Senala cada error con su renglon",
  errores.length === 2 && errores[0].startsWith("Renglon 2") && errores[1].includes("Renglon 9") && errores[1].includes("quizas"), errores.join(" | "));
comprobar("Muestra lo que si entendio", (await caja.locator("[data-pregunta-leida]").count()) === 1);
comprobar("Con errores no deja agregar", (await caja.getByRole("button", { name: /^Agregar \d+ pregunta/ }).count()) === 0 && (await preguntas()).length === 0);

// ---------------- El ejemplo: los cinco casos ----------------
await caja.locator("summary").click();
await caja.getByRole("button", { name: "Poner un ejemplo en el recuadro" }).click();
await vistaPrevia({});
const leidas = await caja.locator("[data-pregunta-leida]").allInnerTexts();
comprobar("Entiende el ejemplo: 5 preguntas y 11 puntos", leidas.length === 5 && (await caja.innerText()).includes("Entendi 5 pregunta(s), 11 puntos"));
comprobar("Reconoce cada tipo de pregunta",
  leidas[0].includes("Opcion multiple") && leidas[1].includes("Varias correctas") && leidas[2].includes("Verdadero o falso") && leidas[3].includes("Opcion multiple") && leidas[4].includes("Abierta"));
await caja.getByRole("button", { name: "Agregar 5 pregunta(s) al examen" }).click();
await docente.getByText(/Se agregaron 5 pregunta/).waitFor({ timeout: 15000 }).catch(() => {});
let guardadas = await preguntas();
comprobar("Al confirmar agrega las 5 preguntas", guardadas.length === 5 && (await texto(docente)).includes("Se agregaron 5 pregunta(s)"));
comprobar("Con sus respuestas correctas y puntos",
  guardadas[0].opciones.find((o) => o.correcta)?.texto === "4" && Number(guardadas[0].puntos) === 2 &&
    guardadas[1].opciones.filter((o) => o.correcta).map((o) => o.texto).join(",") === "2,8" &&
    guardadas[2].tipo === "VERDADERO_FALSO" && guardadas[2].opciones.find((o) => o.correcta)?.texto === "Falso" &&
    guardadas[3].opciones.find((o) => o.correcta)?.texto === "Ciudad de Mexico" &&
    guardadas[4].tipo === "ABIERTA" && Number(guardadas[4].puntos) === 5);
comprobar("Despues de agregar, el recuadro queda limpio", (await caja.getByLabel("Texto del examen").inputValue()) === "");

// ---------------- Desde un archivo de Word ----------------
await vistaPrevia({ archivo: rutaDocx });
const deWord = await caja.locator("[data-pregunta-leida]").allInnerTexts();
comprobar("Lee un .docx con numeracion automatica de Word",
  deWord.length === 2 && deWord[0].includes("3 × 3") && deWord[0].includes("3 pt(s)") && deWord[0].includes("✓ 9") && deWord[1].includes("Verdadero o falso"), deWord.join(" | "));
comprobar("El texto leido pasa al recuadro para corregirlo", (await caja.getByLabel("Texto del examen").inputValue()).includes("1. ¿Cuál es el resultado"));
await caja.getByRole("button", { name: "Agregar 2 pregunta(s) al examen" }).click();
await docente.getByText(/Se agregaron 2 pregunta/).waitFor({ timeout: 15000 }).catch(() => {});
guardadas = await preguntas();
comprobar("Las agrega despues de las que ya tenia", guardadas.length === 7 && guardadas[5].enunciado.includes("3 × 3") && guardadas[6].opciones.find((o) => o.correcta)?.texto === "Verdadero");

// ---------------- Otros archivos ----------------
await vistaPrevia({ escrito: "", archivo: rutaAnsi });
comprobar("Lee un .txt del Bloc de notas con acentos (ANSI)", (await caja.locator("[data-pregunta-leida]").first().innerText()).includes("¿Qué número es par?"));
await docente.goto(`${BASE}/panel/examenes/${examen.id}`);
await vistaPrevia({ archivo: rutaPdf });
comprobar("No acepta otros tipos de archivo", (await caja.innerText()).includes("Sube un archivo .txt o .docx"));
comprobar("Una vista previa sin confirmar no agrega nada", (await preguntas()).length === 7);

// ---------------- Ya cargado funciona como cualquier examen ----------------
await docente.getByRole("button", { name: "Publicar examen" }).click();
await docente.waitForURL(/publicado=1/, { timeout: 15000 });
const alumno = await entrar("2026-0001");
await alumno.goto(`${BASE}/panel/examenes/${examen.id}`);
await alumno.getByRole("button", { name: "Comenzar examen" }).click();
await alumno.waitForURL(/\/contestar$/, { timeout: 15000 });
comprobar("El alumno lo contesta con las preguntas cargadas", (await alumno.locator("[data-pregunta]").count()) === 7);
await docente.goto(`${BASE}/panel/examenes/${examen.id}`);
comprobar("Ya empezado, no se pueden cargar mas preguntas", (await docente.locator("[data-importar-examen]").count()) === 0);
comprobar("La carga queda en la bitacora", (await db.bitacora.count({ where: { entidad: "Examen", accion: "IMPORTAR" } })) === 2);

await navegador.close();
await db.$disconnect();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DE CARGA DE EXAMENES PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
