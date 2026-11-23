import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

// Cambios de horario que pide el docente y aprueba la administracion.
// Requiere una base recien sembrada con los datos de demostracion y
// DATABASE_URL de esa base.

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const db = new PrismaClient();
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const texto = async (p) => (await p.locator("main").innerText()).replace(/\s+/g, " ");

// ---------------- Fechas en la zona del colegio ----------------
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dia = (t) => new Date(`${t}T00:00:00.000Z`);
const sumar = (t, n) => new Date(dia(t).getTime() + n * 86400000).toISOString().slice(0, 10);
const semana = (t) => { const d = dia(t).getUTCDay(); return d === 0 ? 7 : d; };
const diaHoy = semana(hoy);
const diaOtro = (diaHoy % 7) + 1; // manana
const siguiente = (d) => { let f = sumar(hoy, 1); while (semana(f) !== d) f = sumar(f, 1); return f; };
const NOMBRES = ["", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

// ---------------- Horario de partida ----------------
const clases = await db.clase.findMany({ include: { planMateria: { include: { materia: true } } }, orderBy: { id: "asc" } });
const clase = (n) => clases.find((c) => c.planMateria.materia.nombre === n);
const mat = clase("Matematicas I"), lengua = clase("Lengua y Literatura"), anat = clase("Anatomia I");
const hMat = await db.horarioClase.create({ data: { claseId: mat.id, diaSemana: diaOtro, horaInicio: "08:00", horaFin: "08:50" } });
const hLengua = await db.horarioClase.create({ data: { claseId: lengua.id, diaSemana: diaHoy, horaInicio: "07:00", horaFin: "07:50" } });
const hAnat = await db.horarioClase.create({ data: { claseId: anat.id, diaSemana: diaOtro, horaInicio: "09:00", horaFin: "09:50" } });

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
const admin = await entrar("admin");
const alumno = await entrar("2026-0001");

// ---------------- Opcion apagada (asi viene) ----------------
await docente.goto(`${BASE}/panel/mi-horario`);
comprobar("Con la opcion apagada el docente no puede pedir cambios", !(await texto(docente)).includes("Solicitar un cambio de horario"));
await admin.goto(`${BASE}/panel/cambios-horario`);
comprobar("La administracion ve que la opcion esta apagada", (await texto(admin)).includes("esta apagada"));
comprobar("Cambios de horario esta en el menu de la administracion", (await admin.locator("aside").innerText()).includes("Cambios de horario"));
await db.configuracion.update({ where: { clave: "portales.docente_edita_horario" }, data: { valor: "true" } });

// ---------------- El docente pide cambios ----------------
async function pedir({ bloque, tipo = "PERMANENTE", nuevoDia, original, nueva, inicio, fin, motivo = "Junta de academia a esa hora", espera }) {
  await docente.goto(`${BASE}/panel/mi-horario`);
  const form = docente.locator("form", { has: docente.getByRole("button", { name: "Enviar solicitud" }) });
  const selector = form.getByLabel(/^Bloque que quieres mover/);
  const opciones = await selector.locator("option").allTextContents();
  await selector.selectOption({ label: opciones.find((o) => o.startsWith(bloque)) });
  await form.getByLabel(tipo === "PERMANENTE" ? "De aqui en adelante" : "Solo una fecha (reposicion)").check();
  if (tipo === "PERMANENTE") await form.getByLabel(/^Nuevo dia/).selectOption(String(nuevoDia));
  else {
    for (const etiqueta of [/^Fecha de la clase que se mueve/, /^Nueva fecha/]) await form.getByLabel(etiqueta).evaluate((el) => el.removeAttribute("min"));
    await form.getByLabel(/^Fecha de la clase que se mueve/).fill(original);
    await form.getByLabel(/^Nueva fecha/).fill(nueva);
  }
  await form.getByLabel(/^Hora de inicio/).fill(inicio);
  await form.getByLabel(/^Hora de fin/).fill(fin);
  await form.getByLabel("Motivo").fill(motivo);
  await form.getByRole("button", { name: "Enviar solicitud" }).click();
  await docente.getByText(espera).first().waitFor({ timeout: 15000 }).catch(() => {});
  return texto(docente);
}
const ENVIADA = /Solicitud enviada/;

let r = await pedir({ bloque: "Matematicas I", nuevoDia: diaOtro, inicio: "09:00", fin: "09:50", espera: /choca/ });
comprobar("No deja enviar un cambio que choca, y dice con que", r.includes("choca con lo ya programado") && r.includes("Anatomia I"));
comprobar("Lo que choca no llega a la administracion", (await db.solicitudHorario.count()) === 0);

r = await pedir({ bloque: "Matematicas I", nuevoDia: diaHoy, inicio: "10:00", fin: "10:50", espera: ENVIADA });
comprobar("Envia un cambio permanente que no choca", r.includes("Solicitud enviada"));
r = await pedir({ bloque: "Matematicas I", nuevoDia: diaHoy, inicio: "11:00", fin: "11:50", espera: /pendiente/ });
comprobar("No deja dos solicitudes pendientes del mismo bloque", r.includes("Ya tienes una solicitud pendiente"));
comprobar("Mientras no se aprueba su horario no cambia",
  (await db.horarioClase.findUnique({ where: { id: hMat.id } })).diaSemana === diaOtro);

r = await pedir({ bloque: "Lengua y Literatura", tipo: "UNA_FECHA", original: sumar(hoy, 1), nueva: sumar(hoy, 1), inicio: "20:00", fin: "20:50", espera: /la fecha de la clase/ });
comprobar("Para una fecha, la clase que se mueve debe caer en el dia del bloque", r.includes(`debe ser ${NOMBRES[diaHoy].toLowerCase()}`));
r = await pedir({ bloque: "Lengua y Literatura", tipo: "UNA_FECHA", original: sumar(hoy, -7), nueva: hoy, inicio: "20:00", fin: "20:50", espera: /ya paso/ });
comprobar("No deja mover una clase que ya paso", r.includes("ya paso"));
r = await pedir({ bloque: "Lengua y Literatura", tipo: "UNA_FECHA", original: hoy, nueva: hoy, inicio: "20:00", fin: "20:50", espera: ENVIADA });
comprobar("Envia una reposicion de una sola fecha", r.includes("Solicitud enviada"));

r = await pedir({ bloque: "Anatomia I", nuevoDia: diaHoy, inicio: "15:00", fin: "15:50", espera: ENVIADA });
comprobar("Envia otro cambio permanente", r.includes("Solicitud enviada"));
r = await pedir({ bloque: "Anatomia I", tipo: "UNA_FECHA", original: sumar(siguiente(diaOtro), 7), nueva: sumar(siguiente(diaOtro), 8), inicio: "12:00", fin: "12:50", espera: ENVIADA });
comprobar("Envia una reposicion para otra semana", r.includes("Solicitud enviada"));
r = await pedir({ bloque: "Lengua y Literatura", nuevoDia: diaOtro, inicio: "18:00", fin: "18:50", espera: ENVIADA });
await docente.locator('[data-solicitud-horario="PENDIENTE"]', { hasText: "De aqui en adelante" }).filter({ hasText: "Lengua" }).getByRole("button", { name: "Cancelar solicitud" }).click();
await docente.waitForTimeout(1500);
comprobar("El docente puede cancelar una solicitud pendiente", (await db.solicitudHorario.count({ where: { estado: "CANCELADA" } })) === 1);

// ---------------- La administracion revisa ----------------
await admin.goto(`${BASE}/panel`);
comprobar("El panel de la administracion avisa que hay solicitudes", (await texto(admin)).includes("4 solicitud(es) de cambio de horario esperan"));
await admin.goto(`${BASE}/panel/cambios-horario`);
comprobar("La bandeja muestra las pendientes con horario actual, lo pedido y el motivo",
  (await admin.locator("[data-solicitud-pendiente]").count()) === 4 && (await texto(admin)).includes("Junta de academia"));

const sol = async (horarioId, tipo) => db.solicitudHorario.findFirst({ where: { horarioId, tipo, estado: "PENDIENTE" } });
const tarjeta = (s) => admin.locator(`[data-solicitud-pendiente="${s.id}"]`);
async function aprobar(s, ajustes = {}, { avisar = true, espera = /Cambio aprobado/ } = {}) {
  await admin.goto(`${BASE}/panel/cambios-horario`);
  const f = tarjeta(s).locator("[data-aprobar]");
  if (ajustes.inicio) await f.getByLabel(/^Inicio/).fill(ajustes.inicio);
  if (ajustes.fin) await f.getByLabel(/^Fin/).fill(ajustes.fin);
  if (!avisar) await f.getByLabel("Avisar a los alumnos de la clase").uncheck();
  await f.getByRole("button", { name: "Aprobar cambio" }).click();
  await admin.getByText(espera).first().waitFor({ timeout: 15000 }).catch(() => {});
  return texto(admin);
}

// Permanente tal cual, con aviso a los alumnos.
const sMat = await sol(hMat.id, "PERMANENTE");
r = await aprobar(sMat);
const matDespues = await db.horarioClase.findUnique({ where: { id: hMat.id } });
comprobar("Al aprobar, el bloque cambia de dia y hora", matDespues.diaSemana === diaHoy && matDespues.horaInicio === "10:00", r.slice(0, 160));
comprobar("Se publica un aviso para los alumnos de la clase",
  (await db.aviso.count({ where: { titulo: "Cambio de horario: Matematicas I", claseId: mat.id } })) === 1);

// Reposicion de una fecha.
const sLengua = await sol(hLengua.id, "UNA_FECHA");
r = await aprobar(sLengua);
comprobar("La reposicion aprobada no cambia el horario de las demas semanas",
  (await db.horarioClase.findUnique({ where: { id: hLengua.id } })).horaInicio === "07:00" &&
    (await db.cambioHorarioFecha.count({ where: { horarioId: hLengua.id } })) === 1);

// El horario cambio mientras esperaba: al aprobar vuelve a revisar.
const sAnat = await sol(hAnat.id, "PERMANENTE");
await db.horarioClase.create({ data: { claseId: lengua.id, diaSemana: diaHoy, horaInicio: "15:00", horaFin: "15:50" } });
await admin.goto(`${BASE}/panel/cambios-horario`);
comprobar("La bandeja advierte que lo pedido ya choca", (await tarjeta(sAnat).innerText()).includes("ahora choca"));
r = await aprobar(sAnat, {}, { espera: /Con esos datos/ });
comprobar("No deja aprobar algo que ya choca", r.includes("el horario choca") && (await db.horarioClase.findUnique({ where: { id: hAnat.id } })).diaSemana === diaOtro);
r = await aprobar(sAnat, { inicio: "16:00", fin: "16:50" }, { avisar: false });
const sAnatDespues = await db.solicitudHorario.findUnique({ where: { id: sAnat.id } });
comprobar("Puede ajustar la hora y aprobar", (await db.horarioClase.findUnique({ where: { id: hAnat.id } })).horaInicio === "16:00" && sAnatDespues.ajustada);
comprobar("El ajuste le explica al docente que habia pedido", (sAnatDespues.respuesta ?? "").includes("habias pedido") && (sAnatDespues.respuesta ?? "").includes("15:00"));
comprobar("Sin la casilla no se avisa a los alumnos", (await db.aviso.count({ where: { titulo: "Cambio de horario: Anatomia I" } })) === 0);

// Rechazo con motivo.
const sOtra = await sol(hAnat.id, "UNA_FECHA");
await admin.goto(`${BASE}/panel/cambios-horario`);
await tarjeta(sOtra).locator("[data-rechazar]").getByRole("button", { name: "Rechazar" }).click();
await admin.getByText(/motivo del rechazo/).first().waitFor({ timeout: 10000 }).catch(() => {});
comprobar("Para rechazar pide el motivo", (await texto(admin)).includes("Escribe el motivo del rechazo"));
await tarjeta(sOtra).locator("[data-rechazar]").getByLabel("Motivo del rechazo").fill("Esa semana hay examenes; buscamos otra fecha.");
await tarjeta(sOtra).locator("[data-rechazar]").getByRole("button", { name: "Rechazar" }).click();
await admin.getByText(/Solicitud rechazada/).first().waitFor({ timeout: 15000 }).catch(() => {});
comprobar("Rechaza la solicitud", (await db.solicitudHorario.findUnique({ where: { id: sOtra.id } })).estado === "RECHAZADA");
comprobar("Las atendidas quedan en el historial", (await admin.locator("[data-solicitud-atendida]").count()) === 5);

// ---------------- Lo que ven el docente y los alumnos ----------------
await docente.goto(`${BASE}/panel`);
comprobar("El panel del docente le avisa que le contestaron", (await texto(docente)).includes("Te contestaron 4 solicitud(es)"));
await docente.goto(`${BASE}/panel/mi-horario`);
comprobar("El docente ve sus solicitudes aprobadas, ajustadas y rechazadas con el motivo",
  (await docente.locator('[data-solicitud-horario="APROBADA"]').count()) === 3 &&
    (await texto(docente)).includes("Aprobada con ajustes") &&
    (await texto(docente)).includes("Esa semana hay examenes"));

await alumno.goto(`${BASE}/panel/avisos`);
comprobar("El alumno recibe el aviso del cambio", (await texto(alumno)).includes(`A partir de ahora, Matematicas I`));
await alumno.goto(`${BASE}/panel/mi-horario`);
const movido = alumno.locator('[data-bloque="movido"]', { hasText: "Lengua y Literatura" });
const repuesto = alumno.locator('[data-bloque="cambio"]', { hasText: "Lengua y Literatura" });
comprobar("En su horario de esta semana la clase movida aparece tachada con su nueva hora",
  (await movido.count()) === 1 && (await movido.innerText()).includes("cambia a 20:00-20:50"));
comprobar("Y aparece en su nueva hora, marcada como solo esa fecha",
  (await repuesto.count()) === 1 && (await repuesto.innerText()).includes("20:00-20:50") && (await repuesto.innerText()).includes("en lugar de las 07:00"));
comprobar("El cambio permanente ya esta en su horario", (await alumno.locator('[data-bloque="normal"]', { hasText: "Matematicas I" }).innerText()).includes("10:00-10:50"));

// Una reposicion a otro dia de la misma semana.
const otroDiaSemana = diaHoy < 7 ? sumar(hoy, 1) : sumar(hoy, -1);
await db.cambioHorarioFecha.create({ data: { horarioId: hMat.id, fechaOriginal: dia(hoy), fechaNueva: dia(otroDiaSemana), horaInicio: "13:00", horaFin: "13:50" } });
await alumno.goto(`${BASE}/panel/mi-horario`);
const matMovida = alumno.locator('[data-bloque="movido"]', { hasText: "Matematicas I" });
const matRepuesta = alumno.locator('[data-bloque="cambio"]', { hasText: "Matematicas I" });
comprobar("Si se pasa a otro dia, dice a cual y aparece en ese dia",
  (await matMovida.innerText()).includes("Esta semana se pasa al") && (await matRepuesta.innerText()).includes("en lugar del") && (await matRepuesta.innerText()).includes("13:00-13:50"));
await db.cambioHorarioFecha.deleteMany({ where: { horarioId: hMat.id } });

// ---------------- Reposiciones y choques ----------------
r = await pedir({ bloque: "Anatomia I", tipo: "UNA_FECHA", original: siguiente(diaHoy), nueva: hoy, inicio: "20:00", fin: "20:30", espera: /choca/ });
comprobar("Una reposicion no puede caer donde ya hay otra", r.includes("choca") && r.includes("reposicion"));
r = await pedir({ bloque: "Anatomia I", tipo: "UNA_FECHA", original: siguiente(diaHoy), nueva: hoy, inicio: "07:00", fin: "07:50", espera: /Solicitud enviada|choca/ });
comprobar("El lugar que deja una clase movida queda libre ese dia", r.includes("Solicitud enviada"), r.slice(0, 200));

// ---------------- Alcance ----------------
await db.configuracion.update({ where: { clave: "portales.docente_edita_horario" }, data: { valor: "false" } });
await docente.goto(`${BASE}/panel/mi-horario`);
const conOpcionApagada = await texto(docente);
comprobar("Al apagar la opcion desaparece el formulario pero queda el historial",
  !conOpcionApagada.includes("Solicitar un cambio de horario") && conOpcionApagada.includes("Mis solicitudes de cambio"));
await docente.goto(`${BASE}/panel/cambios-horario`);
comprobar("El docente no entra a la bandeja de la administracion", !docente.url().includes("/panel/cambios-horario"));
await alumno.goto(`${BASE}/panel/cambios-horario`);
comprobar("El alumno tampoco", !alumno.url().includes("/panel/cambios-horario"));
comprobar("Todo queda en la bitacora", (await db.bitacora.count({ where: { entidad: "SolicitudHorario" } })) >= 11);

await navegador.close();
await db.$disconnect();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DE CAMBIOS DE HORARIO PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
