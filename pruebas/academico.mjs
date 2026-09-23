import { chromium } from "playwright";

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const limpio = async (p) => (await p.textContent("body")).replace(/\s+/g, " ");

async function entrar(pagina, usuario, password) {
  await pagina.goto(`${BASE}/acceso`);
  await pagina.getByLabel(/^Usuario, matricula o correo\*?$/).fill(usuario);
  await pagina.getByLabel(/^Contrasena\*?$/).fill(password);
  await pagina.getByRole("button", { name: "Entrar" }).click();
  await pagina.waitForURL("**/panel", { timeout: 20000 });
}

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const admin = await navegador.newPage();
admin.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));

// ---------------- Horarios ----------------
await entrar(admin, "admin", "Demo1234");
await admin.goto(`${BASE}/panel/horarios`);
comprobar("Abre la pantalla de horarios", (await limpio(admin)).includes("Agregar bloque al horario"));

await admin.getByLabel(/^Materia\*?$/).selectOption({ index: 1 });
await admin.getByLabel(/^Dia\*?$/).selectOption("1");
await admin.getByLabel(/^Modulo$/).selectOption({ index: 1 });
await admin.getByRole("button", { name: "Agregar al horario" }).click();
await admin.waitForTimeout(2000);
comprobar("Agrega un bloque al horario", (await limpio(admin)).includes("Horario agregado"));

// El mismo bloque otra vez debe chocar (mismo grupo y mismo docente)
await admin.getByLabel(/^Materia\*?$/).selectOption({ index: 1 });
await admin.getByLabel(/^Dia\*?$/).selectOption("1");
await admin.getByLabel(/^Modulo$/).selectOption({ index: 1 });
await admin.getByRole("button", { name: "Agregar al horario" }).click();
await admin.waitForTimeout(2000);
const trasChoque = await limpio(admin);
comprobar("Detecta el choque de horario", trasChoque.includes("choca con lo ya programado"));
comprobar("Explica el motivo del choque", /ya tiene|ya esta ocupada/.test(trasChoque));

// Otra materia el mismo dia y modulo tambien choca (grupo ocupado)
await admin.getByLabel(/^Materia\*?$/).selectOption({ index: 2 });
await admin.getByLabel(/^Dia\*?$/).selectOption("1");
await admin.getByLabel(/^Modulo$/).selectOption({ index: 1 });
await admin.getByRole("button", { name: "Agregar al horario" }).click();
await admin.waitForTimeout(2000);
comprobar("Impide dos materias a la misma hora en el grupo",
  (await limpio(admin)).includes("choca con lo ya programado"));

// En otro dia si entra
await admin.getByLabel(/^Materia\*?$/).selectOption({ index: 2 });
await admin.getByLabel(/^Dia\*?$/).selectOption("2");
await admin.getByLabel(/^Modulo$/).selectOption({ index: 1 });
await admin.getByRole("button", { name: "Agregar al horario" }).click();
await admin.waitForTimeout(2000);
comprobar("Acepta el bloque en otro dia", (await limpio(admin)).includes("Horario agregado"));

await admin.goto(`${BASE}/panel/horarios`);
comprobar("El cuadro muestra los bloques", (await limpio(admin)).includes("Matematicas I"));

// ---------------- Portal del docente ----------------
const contextoDocente = await navegador.newContext();
const docente = await contextoDocente.newPage();
docente.on("pageerror", (e) => console.log("ERROR DE PAGINA (docente):", e.message));
await entrar(docente, "docente", "Demo1234");
await docente.goto(`${BASE}/panel/mis-clases`);
const vistaClases = await limpio(docente);
comprobar("El docente ve sus clases", vistaClases.includes("Matematicas I"));
comprobar("Ve su horario asignado", /Lun \d{2}:\d{2}/.test(vistaClases));

await docente.getByLabel(/La asistencia afecta la calificacion/).first().check();
await docente.getByLabel(/^Peso de la asistencia/).first().fill("10");
await docente.getByRole("button", { name: "Guardar preferencias" }).first().click();
await docente.waitForTimeout(2000);
comprobar("El docente guarda sus preferencias de clase",
  (await limpio(docente)).includes("Preferencias de la clase actualizadas"));

// ---------------- Asistencia y alerta por faltas ----------------
const fechas = ["2026-09-21", "2026-09-22", "2026-09-23"];
let mensajeAlerta = "";
for (const fecha of fechas) {
  await docente.goto(`${BASE}/panel/asistencia?clase=1&fecha=${fecha}`);
  await docente.getByRole("button", { name: "Ausente" }).click();
  await docente.getByRole("button", { name: "Guardar asistencia" }).click();
  await docente.waitForTimeout(2500);
  mensajeAlerta = await limpio(docente);
}
comprobar("Guarda el pase de lista", mensajeAlerta.includes("Asistencia guardada"));
comprobar("Avisa al llegar al limite de faltas consecutivas",
  mensajeAlerta.includes("limite de faltas consecutivas"));

await admin.goto(`${BASE}/panel/asistencia/alertas`);
const vistaAlertas = await limpio(admin);
comprobar("Direccion ve las alertas de inasistencia", vistaAlertas.includes("faltas seguidas"));
comprobar("La alerta nombra la materia", vistaAlertas.includes("Matematicas I"));

await admin.getByRole("textbox", { name: "Notas de seguimiento" }).first().fill("Se cito al tutor");
await admin.getByRole("button", { name: "Marcar atendida" }).first().click();
await admin.waitForTimeout(2000);
comprobar("Se puede atender una alerta", (await limpio(admin)).includes("Se cito al tutor"));

// ---------------- Calificaciones ----------------
await docente.goto(`${BASE}/panel/calificaciones?clase=1&periodo=1`);
comprobar("El docente abre calificaciones", (await limpio(docente)).includes("Rubros del Parcial 1"));

async function agregarRubro(nombre, peso) {
  await docente.getByLabel(/^Nombre del rubro\*?$/).fill(nombre);
  await docente.getByLabel(/^Peso \(%\)\*?$/).fill(String(peso));
  await docente.getByRole("button", { name: "Agregar rubro" }).click();
  await docente.waitForTimeout(2000);
  return limpio(docente);
}

comprobar("Crea el rubro Examen", (await agregarRubro("Examen", 60)).includes("Rubro Examen agregado"));
comprobar("Crea el rubro Tareas", (await agregarRubro("Tareas", 40)).includes("Rubro Tareas agregado"));
const trasExceso = await agregarRubro("Extra", 20);
comprobar("Impide que los pesos pasen de 100", trasExceso.includes("sumarian 120"));

await docente.getByLabel(/^Nombre de la actividad\*?$/).fill("Examen parcial");
await docente.getByLabel(/^Rubro$/).selectOption({ label: "Examen" });
await docente.getByLabel(/^Puntos maximos\*?$/).fill("100");
await docente.getByRole("button", { name: "Crear actividad" }).click();
await docente.waitForTimeout(2500);
comprobar("Crea una actividad", (await limpio(docente)).includes("Actividad Examen parcial creada"));

// Captura de puntos
await docente.goto(`${BASE}/panel/calificaciones?clase=1&periodo=1`);
const campos = docente.locator('input[name^="puntos_"]');
const totalAlumnos = await campos.count();
comprobar("La captura lista a los alumnos de la clase", totalAlumnos === 4, `${totalAlumnos} alumnos`);

const puntajes = ["90", "80", "70", "55"];
for (let i = 0; i < totalAlumnos; i++) await campos.nth(i).fill(puntajes[i] ?? "70");
await docente.getByRole("button", { name: "Guardar puntos" }).click();
await docente.waitForTimeout(2500);
comprobar("Guarda los puntos de la actividad",
  (await limpio(docente)).includes("calificacion(es)"));

// Un puntaje fuera de rango debe rebotar. El navegador ya lo impide por el
// atributo max, asi que aqui se burla esa validacion para comprobar que el
// servidor tambien lo rechaza (que es lo que protege de verdad los datos).
await docente.goto(`${BASE}/panel/calificaciones?clase=1&periodo=1`);
await docente.evaluate(() => {
  const campo = document.querySelector('input[name^="puntos_"]');
  if (campo) {
    campo.removeAttribute("max");
    campo.removeAttribute("type");
    campo.value = "150";
  }
});
await docente.getByRole("button", { name: "Guardar puntos" }).click();
await docente.waitForTimeout(2500);
comprobar("El servidor rechaza puntos fuera del maximo",
  (await limpio(docente)).includes("fuera de rango"));

// Calificacion oficial del periodo
await docente.goto(`${BASE}/panel/calificaciones?clase=1&periodo=1`);
const textoSugeridas = await limpio(docente);
comprobar("Calcula la calificacion sugerida", textoSugeridas.includes("Sugerida"));

await docente.getByRole("button", { name: "Copiar las sugeridas" }).click();
await docente.waitForTimeout(500);
const primeraOficial = await docente.locator('input[name^="calificacion_"]').first().inputValue();
comprobar("Copia las sugeridas a la calificacion oficial", primeraOficial === "90", primeraOficial);

await docente.getByRole("button", { name: "Guardar calificaciones" }).click();
await docente.waitForTimeout(2500);
comprobar("Guarda las calificaciones del periodo",
  (await limpio(docente)).includes("calificacion(es) del periodo"));

await docente.goto(`${BASE}/panel/calificaciones?clase=1&periodo=1`);
await docente.getByRole("button", { name: "Cerrar periodo" }).click();
await docente.waitForTimeout(2500);
comprobar("Cierra el periodo con todo capturado",
  (await limpio(docente)).includes("Periodo cerrado"));

await docente.goto(`${BASE}/panel/calificaciones?clase=1&periodo=1`);
const bloqueado = await docente.locator('input[name^="calificacion_"]').first().isDisabled();
comprobar("Tras cerrar, la calificacion ya no es editable", bloqueado);

// Un periodo con la captura cerrada por direccion no acepta rubros nuevos
await docente.goto(`${BASE}/panel/calificaciones?clase=1&periodo=2`);
await docente.getByLabel(/^Nombre de la actividad\*?$/).fill("Fuera de tiempo");
await docente.getByLabel(/^Puntos maximos\*?$/).fill("10");
await docente.getByRole("button", { name: "Crear actividad" }).click();
await docente.waitForTimeout(2000);
comprobar("Respeta la captura cerrada de otro periodo",
  (await limpio(docente)).includes("esta cerrada"));

// ---------------- Promedios y boleta ----------------
await admin.goto(`${BASE}/panel/boletas`);
await admin.getByRole("button", { name: "Recalcular promedios y ranking" }).click();
await admin.waitForTimeout(4000);
const trasRecalculo = await limpio(admin);
comprobar("Recalcula promedios y ranking", trasRecalculo.includes("con promedio"));
comprobar("El listado muestra el promedio", /Promedio/.test(trasRecalculo));

await admin.getByRole("link", { name: "Boleta", exact: true }).first().click();
await admin.waitForURL(/\/panel\/boletas\/\d+/, { timeout: 15000 });
const boleta = await limpio(admin);
comprobar("La boleta trae el encabezado del colegio", boleta.includes("Colegio de Demostracion"));
comprobar("La boleta dice que es boleta de calificaciones",
  boleta.includes("Boleta de calificaciones"));
comprobar("La boleta lista la materia calificada", boleta.includes("Matematicas I"));
comprobar("La boleta muestra el promedio del ciclo", boleta.includes("Promedio del ciclo"));
comprobar("La boleta reporta la asistencia", boleta.includes("Asistencia"));
comprobar("La boleta indica la escala vigente", boleta.includes("Aprueba con 70"));

// ---------------- Permisos ----------------
await docente.goto(`${BASE}/panel/horarios`);
comprobar("El docente no entra a Horarios", !docente.url().includes("/panel/horarios"), docente.url());
await docente.goto(`${BASE}/panel/boletas`);
comprobar("El docente no entra a Boletas", !docente.url().includes("/panel/boletas"), docente.url());
await docente.goto(`${BASE}/panel/calificaciones?clase=99999`);
comprobar("El docente no abre una clase ajena",
  (await limpio(docente)).includes("no esta a tu cargo"));

await navegador.close();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS ACADEMICAS PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
