import { chromium } from "playwright";

// Grupos con calendario y horario propios. Requiere una base recien sembrada
// con los datos de demostracion (SEED_DEMO=1): usa al docente y al grupo 1A
// del demo, que tiene clases del 17 ago 2026 al 9 jul 2027.

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const fallos = [];
const sello = Date.now().toString().slice(-6);

function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const limpio = async (p) => (await p.textContent("body")).replace(/\s+/g, " ");

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await navegador.newPage();
p.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));

await p.goto(`${BASE}/acceso`);
await p.getByLabel(/^Usuario, matricula o correo\*?$/).fill("admin");
await p.getByLabel(/^Contrasena\*?$/).fill("Demo1234");
await p.getByRole("button", { name: "Entrar" }).click();
await p.waitForURL("**/panel", { timeout: 20000 });

// Un segundo docente, para probar que una materia no puede tener dos.
await p.goto(`${BASE}/panel/personal/nuevo`);
await p.getByLabel(/^Nombre\(s\)\*?$/).fill("Elena");
await p.getByLabel(/^Apellido paterno\*?$/).fill(`Segunda${sello}`);
await p.getByLabel(/^Correo\*?$/).fill(`elena${sello}@demo.mx`);
await p.getByLabel(/^Puesto\*?$/).fill("Docente");
await p.getByRole("button", { name: "Dar de alta" }).click();
await p.waitForURL(/\/panel\/personal\/\d+/, { timeout: 20000 });

async function elegirPorTexto(etiqueta, texto) {
  const opciones = await p.getByLabel(etiqueta).locator("option").allTextContents();
  const opcion = opciones.find((o) => o.includes(texto));
  if (!opcion) throw new Error(`No hay opcion "${texto}" en ${etiqueta}`);
  await p.getByLabel(etiqueta).selectOption({ label: opcion });
}

/// Llena el formulario de nuevo grupo y lo envia.
async function crearGrupo({ nombre, inicio, fin, parciales, renglones }) {
  await p.goto(`${BASE}/panel/grupos`);
  await p.getByLabel(/^Nombre del grupo\*?$/).fill(nombre);
  if (inicio) await p.getByLabel(/^Inicio de clases\*?$/).fill(inicio);
  if (fin) await p.getByLabel(/^Termino de clases\*?$/).fill(fin);
  if (parciales) await p.getByLabel(/^Numero de parciales\*?$/).fill(String(parciales));
  for (const [indice, r] of renglones.entries()) {
    const n = indice + 1;
    if (indice > 0) await p.getByRole("button", { name: "Agregar renglon" }).click();
    await elegirPorTexto(`Materia del renglon ${n}`, r.materia);
    await elegirPorTexto(`Docente del renglon ${n}`, r.docente);
    await p.getByLabel(`Dia del renglon ${n}`).selectOption(String(r.dia));
    await p.getByLabel(`Inicio del renglon ${n}`).fill(r.desde);
    await p.getByLabel(`Fin del renglon ${n}`).fill(r.hasta);
  }
  await p.getByRole("button", { name: "Crear grupo" }).click();
  await Promise.race([
    p.waitForURL(/\/panel\/grupos\/\d+/, { timeout: 15000 }),
    p.waitForSelector("text=Revisa", { timeout: 15000 }),
    p.waitForSelector("text=choca", { timeout: 15000 }),
    p.waitForSelector("text=Ya existe", { timeout: 15000 }),
  ]).catch(() => {});
  await p.waitForTimeout(500);
  return { url: p.url(), texto: await limpio(p) };
}

// ---------- El formulario ----------
await p.goto(`${BASE}/panel/grupos`);
const formulario = await limpio(p);
comprobar("El formulario pide inicio y termino de clases",
  formulario.includes("Inicio de clases") && formulario.includes("Termino de clases"));
comprobar("El formulario ya no pide ciclo escolar", !formulario.includes("Ciclo escolar"));
comprobar("El formulario trae la tabla de horario", formulario.includes("Horario del grupo"));

// Reparto automatico de parciales.
await p.getByLabel(/^Inicio de clases\*?$/).fill("2026-09-01");
await p.getByLabel(/^Termino de clases\*?$/).fill("2026-12-31");
await p.getByLabel(/^Numero de parciales\*?$/).fill("3");
comprobar("Propone 3 parciales", (await p.getByLabel("Nombre del parcial 3").inputValue()) === "Parcial 3");
comprobar("El primer parcial empieza con las clases",
  (await p.getByLabel("Inicio del parcial 1").inputValue()) === "2026-09-01");
comprobar("El ultimo parcial termina con las clases",
  (await p.getByLabel("Fin del parcial 3").inputValue()) === "2026-12-31");
const finP1 = await p.getByLabel("Fin del parcial 1").inputValue();
const iniP2 = await p.getByLabel("Inicio del parcial 2").inputValue();
comprobar("Los parciales no se enciman",
  new Date(iniP2) - new Date(finP1) === 86_400_000, `${finP1} -> ${iniP2}`);

// ---------- Validaciones ----------
const sinFechas = await crearGrupo({
  nombre: `SF-${sello}`,
  renglones: [{ materia: "MAT-1", docente: "Hernandez", dia: 1, desde: "07:00", hasta: "08:00" }],
});
// El navegador detiene el envio: las fechas son obligatorias en el formulario.
comprobar("Exige fechas de clases",
  !/\/panel\/grupos\/\d+/.test(sinFechas.url) &&
    (await p.getByLabel(/^Inicio de clases\*?$/).evaluate((e) => !e.validity.valid)));

const alReves = await crearGrupo({
  nombre: `AR-${sello}`, inicio: "2026-12-01", fin: "2026-09-01", parciales: 2,
  renglones: [{ materia: "MAT-1", docente: "Hernandez", dia: 1, desde: "07:00", hasta: "08:00" }],
});
comprobar("Rechaza termino antes del inicio", alReves.texto.includes("posterior a la de inicio"));

const horaMal = await crearGrupo({
  nombre: `HM-${sello}`, inicio: "2026-09-01", fin: "2026-12-31", parciales: 2,
  renglones: [{ materia: "MAT-1", docente: "Hernandez", dia: 1, desde: "09:00", hasta: "08:00" }],
});
comprobar("Rechaza bloque que termina antes de empezar", horaMal.texto.includes("hora de fin debe ser posterior"));

const dosDocentes = await crearGrupo({
  nombre: `DD-${sello}`, inicio: "2026-09-01", fin: "2026-12-31", parciales: 2,
  renglones: [
    { materia: "MAT-1", docente: "Hernandez", dia: 1, desde: "07:00", hasta: "08:00" },
    { materia: "MAT-1", docente: `Segunda${sello}`, dia: 2, desde: "07:00", hasta: "08:00" },
  ],
});
comprobar("Una materia no puede tener dos docentes", dosDocentes.texto.includes("dos docentes distintos"));

const encimado = await crearGrupo({
  nombre: `EN-${sello}`, inicio: "2026-09-01", fin: "2026-12-31", parciales: 2,
  renglones: [
    { materia: "MAT-1", docente: "Hernandez", dia: 3, desde: "07:00", hasta: "08:00" },
    { materia: "ESP-1", docente: `Segunda${sello}`, dia: 3, desde: "07:30", hasta: "08:30" },
  ],
});
comprobar("Detecta dos materias del mismo grupo a la misma hora",
  encimado.texto.includes("choca") && encimado.texto.includes(`EN-${sello} ya tiene`));
comprobar("Con choque no se guarda nada", !encimado.url.match(/\/panel\/grupos\/\d+/));

// ---------- Grupo A: se crea completo ----------
const grupoA = await crearGrupo({
  nombre: `A-${sello}`, inicio: "2026-09-01", fin: "2026-12-31", parciales: 3,
  renglones: [
    { materia: "MAT-1", docente: "Hernandez", dia: 1, desde: "07:00", hasta: "08:00" },
    { materia: "MAT-1", docente: "Hernandez", dia: 3, desde: "07:00", hasta: "08:00" },
    { materia: "ESP-1", docente: `Segunda${sello}`, dia: 6, desde: "09:00", hasta: "10:30" },
  ],
});
comprobar("Crea el grupo con su horario", /\/panel\/grupos\/\d+/.test(grupoA.url), grupoA.texto.slice(0, 200));
const idA = grupoA.url.match(/\/panel\/grupos\/(\d+)/)?.[1];
comprobar("Muestra sus fechas de clases", grupoA.texto.includes("1 sep 2026") && grupoA.texto.includes("31 dic 2026"));
comprobar("Muestra sus 3 parciales", grupoA.texto.includes("Parcial 3"));
comprobar("El primer parcial abre captura", grupoA.texto.includes("Captura abierta"));
comprobar("Muestra los 3 bloques de horario", grupoA.texto.includes("3 bloque(s) a la semana"));
comprobar("Abre una clase por materia", grupoA.texto.includes("2 clase(s) abiertas"));
comprobar("Muestra el bloque del sabado", grupoA.texto.includes("Sabado 09:00-10:30"));

// ---------- Choques contra otros grupos ----------
const choqueDocente = await crearGrupo({
  nombre: `B-${sello}`, inicio: "2026-10-01", fin: "2027-02-28", parciales: 2,
  renglones: [{ materia: "ANA-1", docente: "Hernandez", dia: 1, desde: "07:30", hasta: "08:30" }],
});
comprobar("Detecta al docente en dos grupos a la vez",
  choqueDocente.texto.includes("choca") && choqueDocente.texto.includes(`con A-${sello}`));

await p.goto(`${BASE}/panel/grupos`);
comprobar("El grupo con choque no quedo guardado", !(await limpio(p)).includes(`B-${sello}`));

// Mismo docente, mismo dia y hora, pero en fechas que no se cruzan: si se puede.
const grupoC = await crearGrupo({
  nombre: `C-${sello}`, inicio: "2027-08-02", fin: "2027-12-17", parciales: 2,
  renglones: [{ materia: "MAT-1", docente: "Hernandez", dia: 1, desde: "07:00", hasta: "08:00" }],
});
comprobar("Acepta el mismo horario en fechas que no se cruzan", /\/panel\/grupos\/\d+/.test(grupoC.url),
  grupoC.texto.slice(0, 300));
const idC = grupoC.url.match(/\/panel\/grupos\/(\d+)/)?.[1];

const homonimo = await crearGrupo({
  nombre: `A-${sello}`, inicio: "2026-11-01", fin: "2027-01-31", parciales: 1,
  renglones: [{ materia: "ANA-1", docente: `Segunda${sello}`, dia: 5, desde: "12:00", hasta: "13:00" }],
});
comprobar("No permite dos grupos con el mismo nombre en las mismas fechas",
  homonimo.texto.includes("Ya existe un grupo llamado"));

// ---------- Inscripcion segun fechas ----------
await p.goto(`${BASE}/panel/grupos/${idA}`);
const opcionesA = await p.getByLabel(/^Alumno\*?$/).locator("option").allTextContents().catch(() => []);
comprobar("Un alumno de 1A no aparece para un grupo con fechas encimadas",
  !opcionesA.some((o) => o.includes("2026-0001")));

await p.goto(`${BASE}/panel/grupos/${idC}`);
await elegirPorTexto(/^Alumno\*?$/, "2026-0001");
await p.getByRole("button", { name: "Inscribir" }).click();
await p.waitForTimeout(2500);
comprobar("El mismo alumno si entra a un grupo de fechas posteriores",
  (await limpio(p)).includes("inscrito en"));

// ---------- Pantalla de horarios ----------
await p.goto(`${BASE}/panel/horarios?grupo=${idA}`);
const horarios = await limpio(p);
comprobar("Horarios muestra las fechas del grupo", horarios.includes("Clases del 1 sep 2026"));
comprobar("Horarios agrega la columna del sabado", horarios.includes("Sabado"));

// ---------- Finanzas: colegiaturas con las fechas del grupo ----------
await p.goto(`${BASE}/panel/finanzas`);
const finanzas = await limpio(p);
comprobar("Finanzas ya no pide ciclo escolar", !finanzas.includes("Ciclo escolar"));
await elegirPorTexto("Grupo", `C-${sello}`);
await p.getByRole("button", { name: "Ver que se generaria" }).click();
await p.waitForTimeout(3000);
const previa = await limpio(p);
const fechas = [...previa.matchAll(/(20\d\d-\d\d-\d\d)/g)].map((m) => m[1]);
comprobar("Calcula cargos para el alumno del grupo C", fechas.length > 0, previa.slice(previa.indexOf("Se generarian"), previa.indexOf("Se generarian") + 120));
comprobar("Los vencimientos caen en las fechas del grupo C",
  fechas.length > 0 && fechas.every((f) => f >= "2027-08-01" && f <= "2027-12-31"), fechas.join(" "));

// ---------- Panel ----------
await p.goto(`${BASE}/panel`);
const panel = await limpio(p);
comprobar("El panel lista los grupos en clases", panel.includes("Grupos en clases") && panel.includes(`A-${sello}`));
comprobar("El panel no lista grupos que aun no empiezan", !panel.includes(`C-${sello}`));

await navegador.close();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DE GRUPOS Y HORARIO PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
