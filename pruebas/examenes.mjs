import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

// Examenes en linea: el docente los arma y publica, el alumno los contesta
// una vez (con tiempo limite y autoguardado), las cerradas se califican
// solas y el docente revisa las abiertas. Requiere una base recien sembrada
// con los datos de demostracion y DATABASE_URL de esa base.

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const db = new PrismaClient();
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const texto = async (p) => (await p.locator("main").innerText()).replace(/\s+/g, " ");
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
const clases = await db.clase.findMany({ include: { planMateria: { include: { materia: true } } } });
const mat = clases.find((c) => c.planMateria.materia.nombre === "Matematicas I");

// ---------------- El docente arma el examen ----------------
async function crearExamen({ titulo, abre = local(-60000), cierra = local(DIA), minutos = "", mostrar = "NUNCA", desordenar = false, tardios = false }) {
  await docente.goto(`${BASE}/panel/examenes`);
  const f = docente.locator("[data-formulario-examen]");
  await f.getByLabel(/^Clase/).selectOption(String(mat.id));
  await f.getByLabel(/^Titulo/).fill(titulo);
  await f.getByLabel(/^Abre/).fill(abre);
  await f.getByLabel(/^Cierra/).fill(cierra);
  await f.getByLabel(/^Tiempo limite/).fill(minutos);
  await f.getByLabel(/^El alumno ve sus respuestas/).selectOption(mostrar);
  if (desordenar) await f.getByLabel(/en desorden/).check();
  if (tardios) await f.getByLabel(/despues del cierre/).check();
  await f.getByRole("button", { name: /Crear examen/ }).click();
  await docente.waitForURL(/\/panel\/examenes\/\d+\?creado=1/, { timeout: 20000 });
  return db.examen.findFirst({ where: { titulo }, orderBy: { id: "desc" } });
}
async function agregar(examenId, { tipo, enunciado, puntos = 1, opciones = [], correctas = [], vf, espera = /Pregunta agregada/ }) {
  const f = docente.locator("[data-formulario-pregunta]");
  await f.getByLabel("Tipo de pregunta").selectOption(tipo);
  await f.getByLabel(/^Puntos/).fill(String(puntos));
  await f.getByLabel("Pregunta", { exact: true }).fill(enunciado);
  if (tipo === "OPCION_UNICA" || tipo === "OPCION_MULTIPLE") {
    for (let i = 0; i < 6; i++) {
      await f.getByLabel(`Opcion ${i + 1}`, { exact: true }).fill(opciones[i] ?? "");
      const marca = f.getByLabel(`Opcion ${i + 1} es correcta`);
      if (tipo === "OPCION_MULTIPLE" && (await marca.isChecked())) await marca.uncheck();
    }
  }
  for (const i of correctas) await f.getByLabel(`Opcion ${i + 1} es correcta`).check();
  if (vf) await f.getByLabel(vf === "V" ? "Verdadero" : "Falso", { exact: true }).check();
  const antes = await db.preguntaExamen.count({ where: { examenId } });
  await f.getByRole("button", { name: "Agregar pregunta" }).click();
  await docente.getByText(espera).first().waitFor({ timeout: 15000 }).catch(() => {});
  if (espera.source === "Pregunta agregada") {
    for (let i = 0; i < 20 && (await db.preguntaExamen.count({ where: { examenId } })) === antes; i++) await docente.waitForTimeout(250);
  }
  return texto(docente);
}

const examen = await crearExamen({ titulo: "Parcial 1 de funciones", minutos: "30", mostrar: "AL_TERMINAR" });
comprobar("Crea el examen como borrador", examen && !examen.publicado && examen.duracionMinutos === 30);
await docente.locator("form").filter({ has: docente.getByRole("button", { name: "Publicar examen" }) }).getByRole("button", { name: "Publicar examen" }).click();
await docente.waitForURL(/aviso=sin-preguntas/, { timeout: 15000 }).catch(() => {});
await docente.getByText(/Agrega al menos una pregunta/).waitFor({ timeout: 10000 }).catch(() => {});
comprobar("No deja publicar sin preguntas", (await texto(docente)).includes("Agrega al menos una pregunta"), docente.url());

let r = await agregar(examen.id, { tipo: "OPCION_UNICA", enunciado: "¿Cuanto es 2 + 2?", puntos: 2, opciones: ["3", "4", "5"], correctas: [], espera: /exactamente una/ });
comprobar("Opcion multiple exige marcar la correcta", r.includes("Marca exactamente una opcion correcta"));
comprobar("Si hay error conserva lo escrito", (await docente.locator("[data-formulario-pregunta]").getByLabel("Pregunta", { exact: true }).inputValue()) === "¿Cuanto es 2 + 2?");
r = await agregar(examen.id, { tipo: "OPCION_MULTIPLE", enunciado: "Sin correctas", opciones: ["a", "b"], correctas: [], espera: /Marca al menos una/ });
comprobar("Varias correctas exige al menos una", r.includes("Marca al menos una opcion correcta"), r.slice(0, 400));
r = await agregar(examen.id, { tipo: "OPCION_UNICA", enunciado: "Una sola opcion", opciones: ["a"], correctas: [0], espera: /al menos dos opciones/ });
comprobar("Pide al menos dos opciones", r.includes("Escribe al menos dos opciones"));
comprobar("Nada de eso se guardo", (await db.preguntaExamen.count({ where: { examenId: examen.id } })) === 0);
await docente.goto(`${BASE}/panel/examenes/${examen.id}`);
await agregar(examen.id, { tipo: "OPCION_UNICA", enunciado: "¿Cuanto es 2 + 2?", puntos: 2, opciones: ["3", "4", "5"], correctas: [1] });
await agregar(examen.id, { tipo: "OPCION_MULTIPLE", enunciado: "¿Cuales son numeros pares?", puntos: 2, opciones: ["2", "3", "8"], correctas: [0, 2] });
await agregar(examen.id, { tipo: "VERDADERO_FALSO", enunciado: "El 7 es par.", puntos: 1, vf: "F" });
r = await agregar(examen.id, { tipo: "ABIERTA", enunciado: "Explica que es una funcion.", puntos: 5 });
const preguntas = await db.preguntaExamen.findMany({ where: { examenId: examen.id }, include: { opciones: true }, orderBy: { orden: "asc" } });
comprobar("Agrega los cuatro tipos de pregunta", preguntas.map((p) => p.tipo).join(",") === "OPCION_UNICA,OPCION_MULTIPLE,VERDADERO_FALSO,ABIERTA");
comprobar("Verdadero/falso guarda la respuesta correcta", preguntas[2].opciones.find((o) => o.correcta)?.texto === "Falso");
comprobar("Muestra el total de puntos", r.includes("4 pregunta(s), 10 puntos"));

const alumno = await entrar("2026-0001");
const borrador = await alumno.goto(`${BASE}/panel/examenes/${examen.id}`);
comprobar("Mientras es borrador el alumno no lo ve", borrador.status() === 404);
await docente.goto(`${BASE}/panel/examenes/${examen.id}`);
await docente.getByRole("button", { name: "Publicar examen" }).click();
await docente.waitForURL(/publicado=1/, { timeout: 15000 });
comprobar("Lo publica", (await db.examen.findUnique({ where: { id: examen.id } })).publicado);

// ---------------- El alumno lo presenta ----------------
await alumno.goto(`${BASE}/panel`);
comprobar("El panel del alumno avisa del examen disponible", (await alumno.locator("[data-pendientes-alumno]").innerText()).includes("1 examen(es) disponible(s)"));
await alumno.goto(`${BASE}/panel/examenes`);
comprobar("Lo ve disponible", (await alumno.locator('[data-examen="Parcial 1 de funciones"]').innerText()).includes("Disponible"));
await alumno.goto(`${BASE}/panel/examenes/${examen.id}`);
comprobar("Antes de empezar le explica el tiempo y que es un solo intento", (await texto(alumno)).includes("Solo tienes un intento") && (await texto(alumno)).includes("30 minutos"));
await alumno.getByRole("button", { name: "Comenzar examen" }).click();
await alumno.waitForURL(/\/contestar$/, { timeout: 15000 });
comprobar("Muestra el reloj con el tiempo que le queda", /29:5\d|30:00/.test(await alumno.locator("[data-reloj]").innerText()));
const html = await alumno.content();
comprobar("La pagina no revela cuales son las correctas", !html.includes('"correcta"'));
const preg = (n) => alumno.locator(`[data-pregunta="${n}"]`);
await preg(1).getByLabel("4", { exact: true }).check();
await preg(2).getByLabel("2", { exact: true }).check(); // falta el 8: todo o nada
await preg(3).getByLabel("Falso", { exact: true }).check();
await preg(4).getByRole("textbox").fill("Una relacion donde a cada x le toca un solo y.");
await alumno.locator('[data-estado-guardado="guardado"]').waitFor({ timeout: 10000 }).catch(() => {});
await alumno.waitForTimeout(1500);
await alumno.reload();
comprobar("Las respuestas se guardan solas (siguen al recargar)",
  (await preg(1).getByLabel("4", { exact: true }).isChecked()) && (await preg(4).getByRole("textbox").inputValue()).includes("un solo y"));
await alumno.getByRole("button", { name: "Enviar examen" }).click();
await alumno.waitForURL(/enviado=1/, { timeout: 20000 });
const intento = await db.intentoExamen.findFirst({ where: { examenId: examen.id } });
comprobar("Califica solas las cerradas: 2 + 0 (le falto una) + 1", Number(intento.puntaje) === 3 && intento.porRevisar, `${intento.puntaje}`);
comprobar("Le muestra su resultado y que falta revisar la abierta", (await alumno.locator("[data-resultado]").innerText()).includes("3 de 10") && (await texto(alumno)).includes("aun revisa"));
comprobar("Como el examen lo permite, ve sus respuestas correctas al terminar",
  (await alumno.locator("[data-revision-pregunta]").count()) === 4 && (await alumno.locator('[data-revision-pregunta="2"]').innerText()).includes("8 (correcta)"));
await alumno.goto(`${BASE}/panel/examenes/${examen.id}/contestar`);
comprobar("No puede volver a contestarlo", !alumno.url().includes("/contestar"));
comprobar("Solo existe un intento", (await db.intentoExamen.count({ where: { examenId: examen.id } })) === 1);

// ---------------- El docente revisa ----------------
await docente.goto(`${BASE}/panel/examenes/${examen.id}`);
const resultado = docente.locator('[data-resultado-alumno="2026-0001"]');
comprobar("El docente ve el resultado y que falta revisar", (await resultado.innerText()).includes("3 / 10") && (await resultado.innerText()).includes("Por revisar"));
comprobar("Ya no puede cambiar las preguntas", (await docente.locator("[data-formulario-pregunta]").count()) === 0);
await resultado.getByRole("link", { name: "Revisar" }).click();
await docente.waitForURL(/\/intento\//);
const abierta = docente.locator("[data-calificar-respuesta]");
await abierta.getByLabel(/^Puntos/).fill("4");
await abierta.getByLabel("Comentario").fill("Bien, falto un ejemplo.");
await abierta.getByRole("button", { name: "Guardar" }).click();
await docente.getByText(/Guardado: 4 de 5/).first().waitFor({ timeout: 10000 }).catch(() => {});
const revisado = await db.intentoExamen.findUnique({ where: { id: intento.id } });
comprobar("Al calificar la abierta se suma al total", Number(revisado.puntaje) === 7 && !revisado.porRevisar);
await alumno.goto(`${BASE}/panel/examenes/${examen.id}`);
comprobar("El alumno ve su calificacion final y el comentario",
  (await alumno.locator("[data-resultado]").innerText()).includes("7 de 10") && (await texto(alumno)).includes("falto un ejemplo"));

// ---------------- Tiempo limite: se envia solo ----------------
const corto = await crearExamen({ titulo: "Quiz relampago", minutos: "1", desordenar: true });
for (let i = 1; i <= 6; i++) await agregar(corto.id, { tipo: "VERDADERO_FALSO", enunciado: `Afirmacion numero ${i}`, vf: i % 2 ? "V" : "F" });
await docente.getByRole("button", { name: "Publicar examen" }).click();
await docente.waitForURL(/publicado=1/, { timeout: 15000 });
const otro = await entrar("2026-0002");
await otro.goto(`${BASE}/panel/examenes/${corto.id}`);
await otro.getByRole("button", { name: "Comenzar examen" }).click();
await otro.waitForURL(/\/contestar$/, { timeout: 15000 });
const intentoCorto = await db.intentoExamen.findFirst({ where: { examenId: corto.id } });
const enPantalla = await otro.locator("[data-pregunta] p.font-medium").allInnerTexts();
const esperado = intentoCorto.orden.preguntas.map((id, i) => `${i + 1}.`);
comprobar("Con desorden, las preguntas salen en el orden que le toco",
  enPantalla.length === 6 && enPantalla.every((t, i) => t.startsWith(esperado[i])) && new Set(intentoCorto.orden.preguntas).size === 6);
comprobar("El vencimiento es al minuto de empezar", Math.abs(intentoCorto.venceEn.getTime() - intentoCorto.iniciadoEn.getTime() - 60000) < 1000);
await otro.locator('[data-pregunta="1"]').getByLabel("Verdadero", { exact: true }).check();
await otro.locator('[data-estado-guardado="guardado"]').waitFor({ timeout: 10000 }).catch(() => {});
await db.intentoExamen.update({ where: { id: intentoCorto.id }, data: { venceEn: new Date(Date.now() + 4000) } });
await otro.reload();
await otro.waitForURL(/enviado=1/, { timeout: 20000 }).catch(() => {});
const auto = await db.intentoExamen.findUnique({ where: { id: intentoCorto.id }, include: { respuestas: true } });
comprobar("Al acabarse el tiempo se envia solo con lo que llevaba", Boolean(auto.enviadoEn) && auto.respuestas.some((r) => r.opciones.length === 1), otro.url());
comprobar("Sin mostrar respuestas, solo ve su calificacion", (await otro.locator("[data-sin-respuestas]").count()) === 1 && (await otro.locator("[data-revision-pregunta]").count()) === 0);

// Si cierra el navegador, al vencer se envia solo con lo guardado.
const tercero = await entrar("2026-0003");
await tercero.goto(`${BASE}/panel/examenes/${corto.id}`);
await tercero.getByRole("button", { name: "Comenzar examen" }).click();
await tercero.waitForURL(/\/contestar$/, { timeout: 15000 });
await tercero.locator('[data-pregunta="1"]').getByLabel("Falso", { exact: true }).check();
await tercero.locator('[data-estado-guardado="guardado"]').waitFor({ timeout: 10000 }).catch(() => {});
await tercero.close();
const abandonado = await db.intentoExamen.findFirst({ where: { examenId: corto.id, alumno: { matricula: "2026-0003" } } });
await db.intentoExamen.update({ where: { id: abandonado.id }, data: { venceEn: new Date(Date.now() - 60000) } });
await docente.goto(`${BASE}/panel/examenes/${corto.id}`);
const cerradoSolo = await db.intentoExamen.findUnique({ where: { id: abandonado.id } });
comprobar("Un examen abandonado se envia solo al vencer, con lo guardado", Boolean(cerradoSolo.enviadoEn) && cerradoSolo.puntaje != null);

// ---------------- Cierre y tardios ----------------
const cerrado = await crearExamen({ titulo: "Examen de ayer", abre: local(-2 * DIA), cierra: local(-DIA + 3600000) }).catch(() => null);
const pasado = cerrado ?? (await db.examen.findFirst({ where: { titulo: "Examen de ayer" } }));
comprobar("No deja crear un examen que ya cerro", !cerrado && (await texto(docente)).includes("posterior a este momento"));
const viejo = await db.examen.create({
  data: {
    claseId: mat.id, titulo: "Examen cerrado", abreEn: new Date(Date.now() - 2 * DIA), cierraEn: new Date(Date.now() - DIA), publicado: true, mostrarRespuestas: "AL_CERRAR",
    preguntas: { create: [{ orden: 1, tipo: "VERDADERO_FALSO", enunciado: "Pregunta", puntos: 1, opciones: { create: [{ orden: 1, texto: "Verdadero", correcta: true }, { orden: 2, texto: "Falso" }] } }] },
  },
});
await alumno.goto(`${BASE}/panel/examenes/${viejo.id}`);
comprobar("Cerrado y sin tardios: no lo puede presentar", (await texto(alumno)).includes("ya cerro y no lo presentaste") && (await alumno.getByRole("button", { name: "Comenzar examen" }).count()) === 0);
await db.examen.update({ where: { id: viejo.id }, data: { aceptaTardios: true } });
await alumno.goto(`${BASE}/panel/examenes/${viejo.id}`);
comprobar("Con tardios permitidos se puede presentar, avisando", (await texto(alumno)).includes("quedara marcado como tarde"));
await alumno.getByRole("button", { name: "Comenzar examen" }).click();
await alumno.waitForURL(/\/contestar$/, { timeout: 15000 });
await alumno.locator('[data-pregunta="1"]').getByLabel("Verdadero", { exact: true }).check();
await alumno.locator('[data-estado-guardado="guardado"]').waitFor({ timeout: 10000 }).catch(() => {});
await alumno.getByRole("button", { name: "Enviar examen" }).click();
await alumno.waitForURL(/enviado=1/, { timeout: 20000 });
comprobar("Queda marcado como tarde", (await db.intentoExamen.findFirst({ where: { examenId: viejo.id } })).tarde);
comprobar("Como ya cerro, con 'al cerrar' ve sus respuestas", (await alumno.locator("[data-revision-pregunta]").count()) === 1);

// ---------------- Alcance ----------------
const ajeno = await entrar("2026-0004");
await db.alumnoClase.updateMany({ where: { alumno: { matricula: "2026-0004" }, claseId: mat.id }, data: { estado: "BAJA" } });
comprobar("Quien no cursa la clase no puede abrir el examen", (await ajeno.goto(`${BASE}/panel/examenes/${examen.id}`)).status() === 404);
await ajeno.goto(`${BASE}/panel/examenes/${examen.id}/intento/${intento.id}`);
comprobar("Un alumno no entra a la revision del docente", !ajeno.url().includes("/intento/"));
comprobar("Queda en la bitacora", (await db.bitacora.count({ where: { entidad: { in: ["Examen", "IntentoExamen", "RespuestaExamen"] } } })) >= 6);
void pasado;

await navegador.close();
await db.$disconnect();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DE EXAMENES PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
