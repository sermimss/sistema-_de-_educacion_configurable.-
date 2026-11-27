import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Tareas: el docente las pide, el alumno entrega archivos y texto, el
// docente califica. Requiere una base recien sembrada con los datos de
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
const carpeta = mkdtempSync(path.join(tmpdir(), "entregas-"));
const archivo = (nombre, contenido) => {
  const ruta = path.join(carpeta, nombre);
  writeFileSync(ruta, contenido);
  return ruta;
};
const pdf = archivo("Ensayo final.pdf", Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(2000, 65), Buffer.from("\n%%EOF")]));
const png = archivo("grafica.png", Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(500, 1)]));
const txt = archivo("notas.txt", "Mis notas de la tarea\n");
const falso = archivo("trampa.pdf", "esto no es un pdf");
const exe = archivo("programa.exe", Buffer.from([0x4d, 0x5a, 0x90, 0x00]));
const grande = archivo("enorme.pdf", Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(10 * 1024 * 1024 + 10, 65)]));

// ---------------- Fechas en la zona del colegio ----------------
const local = (ms) => {
  const v = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(Date.now() + ms))
      .map((p) => [p.type, p.value])
  );
  return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}`;
};
const DIA = 86400000;

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
const alumno = await entrar("2026-0001");
const companero = await entrar("2026-0002");
const clases = await db.clase.findMany({ include: { planMateria: { include: { materia: true } } } });
const mat = clases.find((c) => c.planMateria.materia.nombre === "Matematicas I");

// ---------------- El docente pide una tarea ----------------
comprobar("El docente y el alumno tienen Tareas y Examenes en su menu",
  (await docente.locator("aside").innerText()).includes("Tareas") && (await alumno.locator("aside").innerText()).includes("Examenes"));
async function pedir({ titulo, limite, puntos = 10, tardias = false, espera = /\/panel\/tareas\/\d+\?creada=1/ }) {
  await docente.goto(`${BASE}/panel/tareas`);
  const f = docente.locator("[data-formulario-tarea]");
  await f.getByLabel(/^Clase/).selectOption(String(mat.id));
  await f.getByLabel(/^Titulo/).fill(titulo);
  await f.getByLabel("Instrucciones").fill("Resuelve los ejercicios 1 a 10 y sube tus respuestas en PDF.");
  await f.getByLabel(/^Fecha y hora limite/).evaluate((el) => el.removeAttribute("min"));
  await f.getByLabel(/^Fecha y hora limite/).fill(limite);
  await f.getByLabel(/^Vale/).fill(String(puntos));
  if (tardias) await f.getByLabel(/Aceptar entregas despues/).check();
  await f.getByRole("button", { name: "Pedir tarea" }).click();
  if (espera instanceof RegExp && espera.source.startsWith("\\/panel")) await docente.waitForURL(espera, { timeout: 20000 }).catch(() => {});
  else await docente.getByText(espera).first().waitFor({ timeout: 15000 }).catch(() => {});
  return texto(docente);
}
let r = await pedir({ titulo: "Tarea vieja", limite: local(-DIA), espera: /posterior a este momento/ });
comprobar("No deja pedir una tarea con fecha limite pasada", r.includes("posterior a este momento"));
r = await pedir({ titulo: "Ejercicios de funciones", limite: local(2 * DIA) });
comprobar("Pide la tarea y queda publicada", docente.url().includes("creada=1") && r.includes("Tarea publicada"));
const tarea = await db.tarea.findFirst({ where: { titulo: "Ejercicios de funciones" } });
comprobar("Guarda la fecha limite en la hora del colegio",
  Math.abs(tarea.fechaLimite.getTime() - (Date.now() + 2 * DIA)) < 120000, tarea.fechaLimite.toISOString());

// ---------------- El alumno entrega ----------------
await alumno.goto(`${BASE}/panel`);
comprobar("El panel del alumno avisa de la tarea pendiente", (await alumno.locator("[data-pendientes-alumno]").innerText()).includes("1 tarea(s) por entregar"));
await alumno.goto(`${BASE}/panel/tareas`);
comprobar("La ve en Por entregar", (await alumno.locator('[data-tarea="Ejercicios de funciones"]').innerText()).includes("Por entregar"));
async function entregar(p, archivos, escrito = "", espera = /Tarea entregada|Entrega reemplazada|entregada \(fuera/) {
  await p.goto(`${BASE}/panel/tareas/${tarea.id}`);
  const f = p.locator("[data-formulario-entrega]");
  await f.locator('input[type="file"]').setInputFiles(archivos);
  await f.getByLabel(/^Respuesta o comentario/).fill(escrito);
  await f.getByRole("button", { name: /entregar/i }).click();
  await p.getByText(espera).first().waitFor({ timeout: 30000 }).catch(() => {});
  return texto(p);
}
r = await entregar(alumno, [], "", /al menos un archivo/);
comprobar("No acepta una entrega vacia", r.includes("Sube al menos un archivo o escribe tu respuesta"));
r = await entregar(alumno, [falso], "", /no es realmente/);
comprobar("Detecta un archivo disfrazado (no es PDF de verdad)", r.includes("trampa.pdf no es realmente un archivo .pdf"));
r = await entregar(alumno, [exe], "", /tipo no permitido/);
comprobar("No acepta programas", r.includes("tipo no permitido") && (await db.entregaTarea.count({ where: { tareaId: tarea.id } })) === 0);
r = await entregar(alumno, [grande], "", /pesa mas de 10 MB/);
comprobar("No acepta archivos de mas de 10 MB", r.includes("pesa mas de 10 MB"));
await alumno.goto(`${BASE}/panel/tareas/${tarea.id}`);
await alumno.waitForLoadState("networkidle");
await alumno.locator("[data-formulario-entrega] input[type=file]").setInputFiles([pdf, png, txt]);
await alumno.locator("[data-formulario-entrega] [data-archivos-elegidos] li").nth(2).waitFor({ timeout: 10000 }).catch(() => {});
await alumno.locator("[data-formulario-entrega] input[type=file]").setInputFiles([txt, png, pdf]);
comprobar("Avisa que son maximo 5 archivos y se queda con 5",
  (await alumno.locator("[data-formulario-entrega]").innerText()).includes("Maximo 5 archivos") && (await alumno.locator("[data-formulario-entrega] [data-archivos-elegidos] li").count()) === 5);
r = await entregar(alumno, [pdf, png, txt], "Adjunto mis ejercicios resueltos.");
comprobar("Entrega 3 archivos y su texto", r.includes("Tarea entregada"));
const entrega = await db.entregaTarea.findFirst({ where: { tareaId: tarea.id }, include: { archivos: true } });
comprobar("Se guardan los 3 archivos con su tipo real",
  entrega.archivos.length === 3 && entrega.archivos.some((a) => a.mime === "application/pdf" && a.nombre === "Ensayo final.pdf") && entrega.texto === "Adjunto mis ejercicios resueltos.");

const pdfGuardado = entrega.archivos.find((a) => a.mime === "application/pdf");
const descarga = await alumno.request.get(`${BASE}/panel/tareas/archivo/${pdfGuardado.id}`);
comprobar("El alumno descarga su archivo tal como lo subio",
  descarga.status() === 200 && (await descarga.body()).length === pdfGuardado.tamano && descarga.headers()["content-disposition"].startsWith("attachment"));
comprobar("Un companero no puede descargarlo", (await companero.request.get(`${BASE}/panel/tareas/archivo/${pdfGuardado.id}`)).status() === 404);
const anonimo = await (await navegador.newContext()).request.get(`${BASE}/panel/tareas/archivo/${pdfGuardado.id}`, { maxRedirects: 0 });
comprobar("Sin sesion tampoco", anonimo.status() === 401 || (anonimo.status() >= 300 && anonimo.status() < 400));

r = await entregar(alumno, [pdf], "Version corregida.");
const reemplazo = await db.entregaTarea.findFirst({ where: { tareaId: tarea.id }, include: { archivos: true } });
comprobar("Antes de la fecha puede volver a entregar y se reemplaza todo",
  r.includes("Entrega reemplazada") && reemplazo.archivos.length === 1 && reemplazo.texto === "Version corregida.");

// ---------------- El docente revisa y califica ----------------
await docente.goto(`${BASE}/panel`);
comprobar("El panel del docente avisa de entregas por calificar", (await docente.locator("[data-pendientes-docente]").innerText()).includes("1 entrega(s)"));
await docente.goto(`${BASE}/panel/tareas`);
comprobar("Ve cuantos entregaron y cuantas faltan por calificar",
  (await docente.locator('[data-tarea="Ejercicios de funciones"]').innerText()).includes("1 de 4 entregadas") &&
    (await docente.locator('[data-tarea="Ejercicios de funciones"]').innerText()).includes("1 por calificar"));
await docente.goto(`${BASE}/panel/tareas/${tarea.id}`);
const fila = docente.locator('[data-entrega-alumno="2026-0001"]');
comprobar("Ve la entrega del alumno con su texto y archivo", (await fila.innerText()).includes("Version corregida.") && (await fila.locator("[data-archivo]").count()) === 1);
comprobar("Ve a quien le falta entregar", (await docente.locator('[data-entrega-alumno="2026-0002"]').innerText()).includes("Por entregar"));
const delDocente = await docente.request.get(`${BASE}/panel/tareas/archivo/${reemplazo.archivos[0].id}`);
comprobar("El docente descarga el archivo", delDocente.status() === 200);
await fila.getByLabel(/^Calificacion/).fill("12");
await fila.getByRole("button", { name: "Guardar calificacion" }).click();
await docente.waitForTimeout(800);
comprobar("No acepta mas puntos de los que vale (el formulario no se envia)",
  (await fila.getByLabel(/^Calificacion/).evaluate((el) => el.validity.rangeOverflow)) &&
    (await db.entregaTarea.findUnique({ where: { id: reemplazo.id } })).calificacion === null);
await fila.getByLabel(/^Calificacion/).fill("9");
await fila.getByLabel("Comentario para el alumno").fill("Muy bien, revisa el ejercicio 7.");
await fila.getByRole("button", { name: "Guardar calificacion" }).click();
await docente.getByText(/Calificada: 9 de 10/).first().waitFor({ timeout: 10000 }).catch(() => {});
comprobar("Califica con comentario", Number((await db.entregaTarea.findUnique({ where: { id: reemplazo.id } })).calificacion) === 9);

await alumno.goto(`${BASE}/panel/tareas/${tarea.id}`);
comprobar("El alumno ve su calificacion y el comentario",
  (await alumno.locator("[data-calificacion]").innerText()).includes("9 de 10") && (await texto(alumno)).includes("revisa el ejercicio 7"));
comprobar("Ya calificada no puede volver a entregar", (await alumno.locator("[data-formulario-entrega]").count()) === 0);

// ---------------- Fuera de tiempo ----------------
r = await pedir({ titulo: "Reporte de lectura", limite: local(DIA) });
const tarde = await db.tarea.findFirst({ where: { titulo: "Reporte de lectura" } });
await db.tarea.update({ where: { id: tarde.id }, data: { fechaLimite: new Date(Date.now() - 3600000) } });
await companero.goto(`${BASE}/panel/tareas/${tarde.id}`);
comprobar("Pasada la fecha, sin tardias no deja entregar", (await companero.locator("[data-no-entrega]").innerText()).includes("no acepta entregas tardias"));
await db.tarea.update({ where: { id: tarde.id }, data: { aceptaTardias: true } });
await companero.goto(`${BASE}/panel/tareas/${tarde.id}`);
await companero.locator("[data-formulario-entrega] input[type=file]").setInputFiles([txt]);
await companero.locator("[data-formulario-entrega]").getByRole("button", { name: /entregar/i }).click();
await companero.getByText(/fuera de tiempo/).first().waitFor({ timeout: 15000 }).catch(() => {});
const tardia = await db.entregaTarea.findFirst({ where: { tareaId: tarde.id } });
comprobar("Con tardias permitidas la acepta marcada como tarde", tardia?.tarde === true);
await companero.goto(`${BASE}/panel/tareas/${tarde.id}`);
comprobar("Pero ya no la puede cambiar", (await companero.locator("[data-no-entrega]").innerText()).includes("no se puede cambiar"));
await docente.goto(`${BASE}/panel/tareas/${tarde.id}`);
comprobar("El docente la ve marcada como tarde", (await docente.locator('[data-entrega-alumno="2026-0002"]').innerText()).includes("Entregada tarde"));

// ---------------- Editar, eliminar y alcance ----------------
await docente.goto(`${BASE}/panel/tareas/${tarea.id}`);
comprobar("Con entregas ya no se puede eliminar", !(await texto(docente)).includes("Eliminar tarea"));
await docente.locator("[data-formulario-tarea]").getByLabel(/^Vale/).fill("8");
await docente.locator("[data-formulario-tarea]").getByRole("button", { name: "Guardar cambios" }).click();
await docente.getByText(/mayores a esos puntos/).first().waitFor({ timeout: 10000 }).catch(() => {});
comprobar("No deja bajar los puntos por debajo de una calificacion ya puesta", (await texto(docente)).includes("calificaciones mayores a esos puntos"));
r = await pedir({ titulo: "Tarea por error", limite: local(DIA) });
const error = await db.tarea.findFirst({ where: { titulo: "Tarea por error" } });
await docente.getByRole("button", { name: /Eliminar tarea/ }).click();
await docente.waitForURL(/eliminada=1/, { timeout: 15000 }).catch(() => {});
comprobar("Una tarea sin entregas se puede eliminar", (await db.tarea.count({ where: { id: error.id } })) === 0);

const sofia = await db.alumno.findUnique({ where: { matricula: "2026-0004" } });
await db.alumnoClase.updateMany({ where: { alumnoId: sofia.id, claseId: mat.id }, data: { estado: "BAJA" } });
const fuera = await entrar("2026-0004");
await fuera.goto(`${BASE}/panel/tareas`);
comprobar("Quien no cursa la clase no ve sus tareas", !(await texto(fuera)).includes("Ejercicios de funciones"));
const directa = await fuera.goto(`${BASE}/panel/tareas/${tarea.id}`);
comprobar("Ni puede abrirlas con la direccion", directa.status() === 404);
await (await entrar("admin")).goto(`${BASE}/panel/tareas`).then(async (resp) => {
  comprobar("La administracion no entra a Tareas", !resp.url().endsWith("/panel/tareas"));
});
comprobar("Todo queda en la bitacora", (await db.bitacora.count({ where: { entidad: { in: ["Tarea", "EntregaTarea"] } } })) >= 8);

await navegador.close();
await db.$disconnect();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DE TAREAS PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
