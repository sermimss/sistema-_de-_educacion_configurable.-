import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Archivos en avisos y tareas: imagenes (tambien capturas pegadas con
// Ctrl+V), PDF y documentos; las imagenes se ven ahi mismo, lo demas como
// enlace; cada quien ve solo lo suyo. Requiere una base recien sembrada con
// los datos de demostracion y DATABASE_URL de esa base.

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const db = new PrismaClient();
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const texto = async (p) => (await p.locator("main").innerText()).replace(/\s+/g, " ");

// ---------------- Archivos de prueba ----------------
// PNG real de 1x1 para que el navegador lo pueda dibujar.
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const carpeta = mkdtempSync(path.join(tmpdir(), "adjuntos-"));
const archivo = (nombre, contenido) => {
  const ruta = path.join(carpeta, nombre);
  writeFileSync(ruta, contenido);
  return ruta;
};
const foto = archivo("foto del evento.png", Buffer.from(PNG_B64, "base64"));
const pdf = archivo("Calendario.pdf", Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(800, 65), Buffer.from("\n%%EOF")]));
const falsa = archivo("falsa.png", "esto no es una imagen");

const local = (ms) => {
  const v = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(Date.now() + ms))
      .map((p) => [p.type, p.value])
  );
  return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}`;
};

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

/// Pega una captura (como Ctrl+V de una imagen copiada) dentro del elemento.
async function pegarCaptura(p, selector) {
  await p.locator(selector).first().evaluate((el, b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "image.png", { type: "image/png" }));
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PNG_B64);
}

const admin = await entrar("admin");
const docente = await entrar("docente");
const alumno = await entrar("2026-0001");

// ---------------- Avisos ----------------
await admin.goto(`${BASE}/panel/avisos`);
const fa = admin.locator("[data-formulario-aviso]");
await fa.getByLabel(/^Titulo/).fill("Festival de fin de semestre");
await fa.getByLabel("Aviso").fill("Les compartimos el programa y una foto del ensayo.");
await fa.locator('input[type="file"]').setInputFiles([foto, pdf]);
await pegarCaptura(admin, "#contenido-aviso");
const elegidos = await fa.locator("[data-archivos-elegidos] li").allInnerTexts();
comprobar("Se pueden elegir archivos y pegar una captura con Ctrl+V", elegidos.length === 3 && elegidos.some((t) => /^captura-\d{4}-\d{2}-\d{2}-\d{6}\.png/.test(t)), elegidos.join(" | "));
await fa.getByLabel(/^Titulo/).fill("Fe");
await fa.getByRole("button", { name: "Publicar aviso" }).click();
await admin.getByText("Escribe el titulo del aviso").waitFor({ timeout: 15000 }).catch(() => {});
comprobar("Con un error conserva lo escrito y los archivos",
  (await fa.getByLabel("Aviso").inputValue()).includes("programa") && (await fa.locator("[data-archivos-elegidos] li").count()) === 3);
await fa.getByLabel(/^Titulo/).fill("Festival de fin de semestre");
await fa.getByRole("button", { name: "Publicar aviso" }).click();
await admin.getByText(/Aviso publicado/).waitFor({ timeout: 20000 }).catch(() => {});
const aviso = await db.aviso.findFirst({ where: { titulo: "Festival de fin de semestre" }, include: { archivos: true } });
comprobar("Publica el aviso con sus 3 archivos", aviso?.archivos.length === 3 && aviso.archivos.filter((a) => a.mime === "image/png").length === 2);
comprobar("Al publicarse se limpia el formulario", (await fa.locator("[data-archivos-elegidos] li").count()) === 0 && (await fa.getByLabel("Aviso").inputValue()) === "");

await fa.getByLabel(/^Titulo/).fill("Aviso con trampa");
await fa.getByLabel("Aviso").fill("Imagen falsa");
await fa.locator('input[type="file"]').setInputFiles([falsa]);
await fa.getByRole("button", { name: "Publicar aviso" }).click();
await admin.getByText(/no es realmente/).waitFor({ timeout: 15000 }).catch(() => {});
comprobar("Rechaza una imagen que no lo es", (await texto(admin)).includes("falsa.png no es realmente un archivo .png") && !(await db.aviso.findFirst({ where: { titulo: "Aviso con trampa" } })));

await alumno.goto(`${BASE}/panel/avisos`);
const tarjeta = alumno.locator("[data-aviso]").filter({ hasText: "Festival de fin de semestre" });
const imagenes = tarjeta.locator("[data-adjunto-imagen] img");
comprobar("El alumno ve las imagenes dentro del aviso", (await imagenes.count()) === 2 && (await imagenes.first().evaluate((img) => img.complete && img.naturalWidth > 0)));
comprobar("Y el PDF como enlace", (await tarjeta.locator('[data-adjunto="Calendario.pdf"]').count()) === 1);
const pdfAviso = aviso.archivos.find((a) => a.mime === "application/pdf");
const r1 = await alumno.request.get(`${BASE}/panel/avisos/archivo/${pdfAviso.id}`);
comprobar("Abre el PDF en el navegador", r1.ok() && r1.headers()["content-type"] === "application/pdf" && r1.headers()["content-disposition"].startsWith("inline"));
await alumno.goto(`${BASE}/panel`);
comprobar("El panel indica que el aviso trae archivos", (await alumno.locator("[data-avisos-recientes]").innerText()).includes("3 archivo(s) adjunto(s)"));

// Un aviso para otro grupo: sus archivos no se ven.
const ajeno = await db.aviso.create({
  data: { titulo: "Solo otro grupo", contenido: "x", ambito: "GRUPO", referenciaId: 999999, dirigidoA: ["ALUMNO"], archivos: { create: [{ nombre: "x.png", mime: "image/png", tamano: 3, datos: Buffer.from([1, 2, 3]) }] } },
  include: { archivos: true },
});
const r2 = await alumno.request.get(`${BASE}/panel/avisos/archivo/${ajeno.archivos[0].id}`);
comprobar("El alumno no puede abrir archivos de avisos que no son para el", r2.status() === 404);
const r3 = await docente.request.get(`${BASE}/panel/avisos/archivo/${pdfAviso.id}`);
comprobar("Un docente no abre archivos de avisos que no publico", r3.status() === 404);
const anonimo = await (await navegador.newContext()).request.get(`${BASE}/panel/avisos/archivo/${pdfAviso.id}`);
comprobar("Sin sesion no se abre (lleva a iniciar sesion)", anonimo.headers()["content-type"] !== "application/pdf" && (anonimo.url().includes("/acceso") || anonimo.status() === 401), `${anonimo.status()} ${anonimo.url()}`);

// ---------------- Material de tareas ----------------
const mat = (await db.clase.findMany({ include: { planMateria: { include: { materia: true } } } })).find((c) => c.planMateria.materia.nombre === "Matematicas I");
await docente.goto(`${BASE}/panel/tareas`);
const ft = docente.locator("[data-formulario-tarea]");
await ft.getByLabel(/^Clase/).selectOption(String(mat.id));
await ft.getByLabel(/^Titulo/).fill("Practica con grafica");
await ft.getByLabel("Instrucciones").fill("Observa la grafica adjunta y responde.");
await ft.getByLabel(/^Fecha y hora limite/).evaluate((el) => el.removeAttribute("min"));
await ft.getByLabel(/^Fecha y hora limite/).fill(local(3 * 86400000));
await ft.locator('input[type="file"]').setInputFiles([pdf]);
await pegarCaptura(docente, "[data-formulario-tarea] textarea");
await ft.getByRole("button", { name: "Pedir tarea" }).click();
await docente.waitForURL(/\/panel\/tareas\/\d+\?creada=1/, { timeout: 20000 }).catch(() => {});
const tarea = await db.tarea.findFirst({ where: { titulo: "Practica con grafica" }, include: { material: true } });
comprobar("El docente adjunta material (PDF y captura pegada) al pedir la tarea", tarea?.material.length === 2 && tarea.material.some((a) => a.nombre.startsWith("captura-")));

await alumno.goto(`${BASE}/panel/tareas/${tarea.id}`);
comprobar("El alumno ve la captura dentro de las instrucciones y el PDF como enlace",
  (await alumno.locator("[data-adjuntos] [data-adjunto-imagen] img").count()) === 1 && (await alumno.locator('[data-adjuntos] [data-adjunto="Calendario.pdf"]').count()) === 1);
const pdfMaterial = tarea.material.find((a) => a.mime === "application/pdf");
comprobar("Y lo abre", (await alumno.request.get(`${BASE}/panel/tareas/material/${pdfMaterial.id}`)).ok());
comprobar("La administracion no abre material de tareas ajenas", (await admin.request.get(`${BASE}/panel/tareas/material/${pdfMaterial.id}`)).status() === 404);

// Editar: quitar el PDF y agregar una foto.
await docente.goto(`${BASE}/panel/tareas/${tarea.id}`);
const fe = docente.locator("[data-formulario-tarea]");
await fe.getByLabel("Quitar Calendario.pdf").check();
await fe.locator('input[type="file"]').setInputFiles([foto]);
await fe.getByRole("button", { name: "Guardar cambios" }).click();
await docente.getByText("Tarea actualizada").waitFor({ timeout: 20000 }).catch(() => {});
const material = await db.archivoTarea.findMany({ where: { tareaId: tarea.id } });
comprobar("Al editar quita y agrega material", material.length === 2 && !material.some((a) => a.nombre === "Calendario.pdf") && material.some((a) => a.nombre === "foto del evento.png"));

// ---------------- Entrega con captura pegada ----------------
await alumno.goto(`${BASE}/panel/tareas/${tarea.id}`);
const fen = alumno.locator("[data-formulario-entrega]");
await pegarCaptura(alumno, "[data-formulario-entrega] textarea");
await fen.getByLabel(/^Respuesta o comentario/).fill("Mi respuesta en la captura.");
await fen.getByRole("button", { name: /entregar/i }).click();
await alumno.getByText("Tarea entregada").first().waitFor({ timeout: 20000 }).catch(() => {});
const entrega = await db.entregaTarea.findFirst({ where: { tareaId: tarea.id }, include: { archivos: true } });
comprobar("El alumno entrega pegando una captura", entrega?.archivos.length === 1 && entrega.archivos[0].mime === "image/png" && entrega.archivos[0].nombre.startsWith("captura-"));

await navegador.close();
await db.$disconnect();
if (fallos.length) {
  console.log(`\nFALLARON ${fallos.length}: ${fallos.join(" | ")}`);
  process.exit(1);
}
console.log("\nTODAS LAS PRUEBAS DE ARCHIVOS EN AVISOS Y TAREAS PASARON");
