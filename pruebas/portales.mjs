import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

// Portales de docentes y alumnos, Google Meet, avisos, adeudos visibles al
// docente y cambio de modalidad de un plan. Requiere una base recien
// sembrada con los datos de demostracion y DATABASE_URL de esa base.

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const db = new PrismaClient();
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const limpio = async (p) => (await p.textContent("body")).replace(/\s+/g, " ");

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function entrar(usuario, password) {
  const p = await (await navegador.newContext()).newPage();
  p.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));
  await p.goto(`${BASE}/acceso`);
  await p.getByLabel(/^Usuario, matricula o correo\*?$/).fill(usuario);
  await p.getByLabel(/^Contrasena\*?$/).fill(password);
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.waitForURL("**/panel", { timeout: 20000 });
  return p;
}

// ---------------- Horario de hoy, alrededor de la hora actual ----------------
// El demo no trae horarios: se pone uno hoy, en curso, y otro manana.
const partes = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Mexico_City", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
}).formatToParts(new Date());
const parte = (t) => partes.find((p) => p.type === t).value;
const hoy = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parte("weekday")];
const minutosAhora = (Number(parte("hour")) % 24) * 60 + Number(parte("minute"));
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const inicio = Math.max(0, Math.min(minutosAhora - 5, 23 * 60));
const fin = Math.min(inicio + 50, 23 * 60 + 59);
const clases = await db.clase.findMany({ include: { planMateria: { include: { materia: true } } }, orderBy: { id: "asc" } });
const matematicas = clases.find((c) => c.planMateria.materia.nombre === "Matematicas I");
const lengua = clases.find((c) => c.planMateria.materia.nombre === "Lengua y Literatura");
await db.horarioClase.createMany({
  data: [
    { claseId: matematicas.id, diaSemana: hoy, horaInicio: hhmm(inicio), horaFin: hhmm(fin) },
    { claseId: lengua.id, diaSemana: (hoy % 7) + 1, horaInicio: "08:00", horaFin: "08:50" },
  ],
});

// ---------------- Google Meet en el portal del docente ----------------
const docente = await entrar("docente", "Demo1234");
const menuDocente = await docente.locator("aside").textContent();
comprobar("El docente tiene 'Mi horario' y 'Avisos' en su menu", menuDocente.includes("Mi horario") && menuDocente.includes("Avisos"));
await docente.goto(`${BASE}/panel/mis-clases`);
const campoMat = docente.getByLabel("Enlace de Google Meet de Matematicas I");
await campoMat.fill("https://sitio-falso.com/meet/abc");
await campoMat.locator("xpath=..").getByRole("button", { name: "Guardar" }).click();
await docente.waitForTimeout(1500);
comprobar("Solo acepta enlaces de Google Meet", (await limpio(docente)).includes("Solo se aceptan enlaces de Google Meet"));
await campoMat.fill("abc-defg-hij");
await campoMat.locator("xpath=..").getByRole("button", { name: "Guardar" }).click();
await docente.waitForSelector("text=Enlace guardado", { timeout: 15000 });
comprobar("Acepta solo el codigo de la reunion y lo completa",
  (await db.clase.findUnique({ where: { id: matematicas.id } })).enlaceReunion === "https://meet.google.com/abc-defg-hij");
const campoLengua = docente.getByLabel("Enlace de Google Meet de Lengua y Literatura");
await campoLengua.fill("meet.google.com/xyz-wxyz-xyz?authuser=0");
await campoLengua.locator("xpath=..").getByRole("button", { name: "Usar en todas mis clases" }).click();
await docente.waitForSelector("text=Enlace puesto en tus 3 clases", { timeout: 15000 });
const enlaces = (await db.clase.findMany({ where: { docenteId: matematicas.docenteId } })).map((c) => c.enlaceReunion);
comprobar("'Usar en todas mis clases' pone la misma sala en todas, sin datos extra",
  enlaces.length === 3 && enlaces.every((e) => e === "https://meet.google.com/xyz-wxyz-xyz"), enlaces.join(" "));

await docente.goto(`${BASE}/panel/mi-horario`);
const horarioDocente = await limpio(docente);
comprobar("El docente ve su horario semanal", horarioDocente.includes("Matematicas I") && horarioDocente.includes("Lengua y Literatura") && horarioDocente.includes("La semana"));
comprobar("Su horario resalta la clase en curso", horarioDocente.includes("en curso"));
await docente.goto(`${BASE}/panel`);
const enPanelDocente = docente.locator("[data-clases-hoy] [data-boton-meet]");
comprobar("El panel del docente muestra sus clases de hoy con Meet", (await enPanelDocente.count()) >= 1);

// ---------------- El alumno entra a la clase en linea ----------------
const alumno = await entrar("2026-0001", "Demo1234");
const botonHoy = alumno.locator("[data-clases-hoy] [data-boton-meet]").first();
comprobar("El panel del alumno muestra su clase en curso con boton de Meet",
  (await botonHoy.getAttribute("href")) === "https://meet.google.com/xyz-wxyz-xyz" &&
    (await alumno.locator("[data-clases-hoy]").textContent()).includes("en curso"));
comprobar("El boton de Meet abre en otra pestana sin pasar datos",
  (await botonHoy.getAttribute("target")) === "_blank" && (await botonHoy.getAttribute("rel")).includes("noreferrer"));
await alumno.goto(`${BASE}/panel/mi-horario`);
comprobar("El horario semanal del alumno trae los botones de Meet",
  (await alumno.locator("[data-boton-meet]").count()) >= 2);

// ---------------- Avisos ----------------
const admin = await entrar("admin", "Demo1234");
async function publicar(p, titulo, contenido, para) {
  await p.goto(`${BASE}/panel/avisos`);
  await p.getByLabel(/^Titulo\*?$/).fill(titulo);
  await p.getByLabel("Aviso", { exact: true }).fill(contenido);
  const selector = p.getByLabel(/^Para\*?$/);
  const opciones = await selector.locator("option").allTextContents();
  await selector.selectOption({ label: opciones.find((o) => o.startsWith(para)) });
  await p.getByRole("button", { name: "Publicar aviso" }).click();
  await p.waitForSelector("text=Aviso publicado", { timeout: 15000 });
}
await publicar(admin, "Suspension de clases", "El viernes no hay clases por junta de consejo.", "Todos los alumnos");
await publicar(admin, "Junta del grupo 1A", "Junta de padres del 1A el lunes.", "Grupo 1A");
await docente.goto(`${BASE}/panel/avisos`);
const opcionesDocente = await docente.getByLabel(/^Para\*?$/).locator("option").allTextContents();
comprobar("El docente solo puede publicar a sus clases",
  opcionesDocente.length === 3 && opcionesDocente.every((o) => o.includes("· 1A")) && !opcionesDocente.includes("Todos los alumnos"), opcionesDocente.join(" | "));
await publicar(docente, "Tarea de Matematicas", "Resolver la pagina 20 para el martes.", "Matematicas I · 1A");
comprobar("El docente ve solo sus avisos publicados",
  (await limpio(docente)).includes("Tarea de Matematicas") && !(await limpio(docente)).includes("Suspension de clases"));

await alumno.goto(`${BASE}/panel/avisos`);
const avisosAlumno = await limpio(alumno);
comprobar("El alumno ve los avisos del colegio, de su grupo y de su clase",
  ["Suspension de clases", "Junta del grupo 1A", "Tarea de Matematicas"].every((t) => avisosAlumno.includes(t)));
await alumno.goto(`${BASE}/panel`);
comprobar("Su panel muestra los avisos recientes", (await alumno.locator("[data-avisos-recientes]").textContent()).includes("Tarea de Matematicas"));

await admin.goto(`${BASE}/panel/avisos`);
await admin.locator("[data-aviso]", { hasText: "Suspension de clases" }).getByRole("button", { name: "Retirar" }).click();
await admin.waitForTimeout(1500);
await alumno.goto(`${BASE}/panel/avisos`);
comprobar("Un aviso retirado ya no lo ve el alumno", !(await limpio(alumno)).includes("Suspension de clases"));

await db.configuracion.update({ where: { clave: "portales.alumno_ve_avisos" }, data: { valor: "false" } });
await alumno.goto(`${BASE}/panel/avisos`);
comprobar("El colegio puede apagar los avisos del portal del alumno", (await limpio(alumno)).includes("desactivada"));
await db.configuracion.update({ where: { clave: "portales.alumno_ve_avisos" }, data: { valor: "true" } });

// ---------------- Adeudos visibles al docente ----------------
const sofia = await db.alumno.findUnique({ where: { matricula: "2026-0001" } });
// El adeudo se calcula por fecha: un cargo con saldo que ya vencio.
await db.cargo.create({
  data: {
    folio: "PRUEBA-ADEUDO", alumnoId: sofia.id, descripcion: "Colegiatura vencida", montoOriginal: 500, montoTotal: 500,
    saldo: 500, fechaVencimiento: new Date(Date.now() - 5 * 86400000), estado: "PENDIENTE",
  },
});
await docente.goto(`${BASE}/panel/asistencia?clase=${matematicas.id}`);
comprobar("Por omision el docente no ve adeudos", (await docente.locator("[data-marca-adeudo]").count()) === 0);
await db.configuracion.update({ where: { clave: "portales.docente_ve_adeudos" }, data: { valor: "true" } });
await docente.goto(`${BASE}/panel/asistencia?clase=${matematicas.id}`);
comprobar("Si el colegio lo activa, el docente ve la marca en su lista", (await docente.locator("[data-marca-adeudo]").count()) === 1);
await docente.goto(`${BASE}/panel/calificaciones?clase=${matematicas.id}`);
comprobar("Tambien en la captura de calificaciones, sin montos",
  (await docente.locator("[data-marca-adeudo]").count()) >= 1 && !(await docente.locator("main").innerText()).includes("$"),
  `marcas=${await docente.locator("[data-marca-adeudo]").count()}`);

// ---------------- Alcance de cada portal ----------------
for (const ruta of ["/panel/academico", "/panel/alumnos", "/panel/finanzas", "/panel/mis-clases", "/panel/configuracion"]) {
  await alumno.goto(`${BASE}${ruta}`);
  comprobar(`El alumno no entra a ${ruta}`, !alumno.url().endsWith(ruta), alumno.url());
}
for (const ruta of ["/panel/academico", "/panel/finanzas", "/panel/configuracion"]) {
  await docente.goto(`${BASE}${ruta}`);
  comprobar(`El docente no entra a ${ruta}`, !docente.url().endsWith(ruta), docente.url());
}
// Aunque altere el formulario, el servidor no le deja publicar a todo el colegio.
await docente.goto(`${BASE}/panel/avisos`);
await docente.getByLabel(/^Titulo\*?$/).fill("Aviso a todos");
await docente.getByLabel("Aviso", { exact: true }).fill("No deberia publicarse.");
await docente.getByLabel(/^Para\*?$/).evaluate((el) => { el.options[0].value = "todos"; });
await docente.getByRole("button", { name: "Publicar aviso" }).click();
await docente.waitForTimeout(2000);
comprobar("El docente no puede publicar a todo el colegio", (await db.aviso.count({ where: { titulo: "Aviso a todos" } })) === 0);

// ---------------- Cambio de modalidad ----------------
await admin.goto(`${BASE}/panel/academico`);
const estructura = await limpio(admin);
comprobar("Estructura academica muestra la modalidad de cada plan", estructura.includes("Semestral") && estructura.includes("Administrar"));
await admin.getByRole("link", { name: "Administrar" }).first().click();
await admin.waitForURL(/\/panel\/academico\/plan\/\d+/);
await admin.getByLabel(/^Nueva modalidad\*?$/).selectOption("CUATRIMESTRE");
comprobar("Propone la misma duracion: 6 semestres son 9 cuatrimestres",
  (await admin.getByLabel(/^Numero de periodos\*?$/).inputValue()) === "9" &&
    (await admin.locator("[data-vista-periodos]").textContent()).includes("9o Cuatrimestre"));
comprobar("Con alumnos inscritos avisa que se creara un plan nuevo", (await limpio(admin)).includes("se creara un plan nuevo"));
await admin.getByLabel(/^Clave del plan nuevo\*?$/).fill("BG-02");
await admin.getByRole("button", { name: "Crear el plan nuevo" }).click();
await admin.waitForURL(/cambiado=version/, { timeout: 30000 });
const nuevoPlan = await db.planEstudios.findUnique({
  where: { clave: "BG-02" },
  include: { grados: { orderBy: { numero: "asc" } }, materias: { include: { grado: true, materia: true, prerrequisitos: true } } },
});
const viejo = await db.planEstudios.findUnique({ where: { clave: "BG-01" }, include: { _count: { select: { alumnos: true } } } });
comprobar("Crea el plan cuatrimestral con sus 9 periodos",
  nuevoPlan?.modalidad === "CUATRIMESTRE" && nuevoPlan.grados.length === 9 && nuevoPlan.grados[8].nombre === "9o Cuatrimestre");
comprobar("Copia las materias repartidas en los periodos nuevos",
  nuevoPlan.materias.length === 4 && nuevoPlan.materias.find((m) => m.materia.clave === "ANA-2")?.grado.numero === 2);
comprobar("Copia tambien los prerrequisitos", nuevoPlan.materias.some((m) => m.prerrequisitos.length === 1));
comprobar("Los alumnos actuales se quedan en su plan semestral", viejo._count.alumnos === 4 && viejo.modalidad === "SEMESTRE");

await admin.goto(`${BASE}/panel/alumnos/nuevo`);
const planesAlta = await admin.getByLabel(/^Plan de estudios\*?$/).locator("option").allTextContents();
comprobar("El plan anterior ya no recibe alumnos de nuevo ingreso",
  planesAlta.length === 2 && planesAlta[1].includes("(Cuatrimestral)"), planesAlta.join(" | "));

// El plan nuevo no tiene alumnos: se convierte tal cual.
await admin.goto(`${BASE}/panel/academico/plan/${nuevoPlan.id}`);
await admin.getByLabel(/^Nueva modalidad\*?$/).selectOption("SEMESTRE");
comprobar("Sin alumnos, el plan se convierte directo", (await limpio(admin)).includes("se convierte tal cual"));
comprobar("Propone 6 semestres para 9 cuatrimestres", (await admin.getByLabel(/^Numero de periodos\*?$/).inputValue()) === "6");
await admin.getByRole("button", { name: "Convertir el plan" }).click();
await admin.waitForURL(/cambiado=convertido/, { timeout: 30000 });
const convertido = await db.planEstudios.findUnique({
  where: { id: nuevoPlan.id },
  include: { grados: { orderBy: { numero: "asc" } }, materias: { include: { grado: true, materia: true } } },
});
comprobar("Queda semestral con 6 periodos y sus nombres nuevos",
  convertido.modalidad === "SEMESTRE" && convertido.duracionPeriodos === 6 && convertido.grados.length === 6 && convertido.grados[5].nombre === "6o Semestre");
comprobar("Conserva sus 4 materias repartidas", convertido.materias.length === 4 && convertido.materias.every((m) => m.grado.numero <= 2));

await navegador.close();
await db.$disconnect();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DE PORTALES PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
