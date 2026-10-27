import { chromium } from "playwright";

// El sistema en un celular: menu que abre y cierra, que lleva a cada pantalla,
// y pantallas que no se salen a lo ancho. Base con datos de demostracion
// (SEED_DEMO=1); no modifica nada, se puede repetir.

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
// Tamano de un celular comun (390 x 844), con pantalla tactil.
const CELULAR = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

async function entrar(usuario, password, opciones = CELULAR) {
  const contexto = await navegador.newContext(opciones);
  const p = await contexto.newPage();
  p.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));
  await p.goto(`${BASE}/acceso`);
  await p.getByLabel(/^Usuario, matricula o correo\*?$/).fill(usuario);
  await p.getByLabel(/^Contrasena\*?$/).fill(password);
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.waitForURL("**/panel", { timeout: 20000 });
  return p;
}

const sobrante = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const menu = (p) => p.getByRole("dialog");

// ---------------- Administracion ----------------
const admin = await entrar("admin", "Demo1234");
comprobar("En el celular el menu lateral fijo no estorba", !(await admin.locator("aside").isVisible()));
const boton = admin.getByRole("button", { name: "Abrir menu" });
comprobar("Hay un boton para abrir el menu", await boton.isVisible());

await boton.click();
comprobar("El boton abre el menu", await menu(admin).isVisible());
const opciones = await menu(admin).getByRole("link").allTextContents();
for (const esperada of ["Panel", "Alumnos", "Grupos y clases", "Documentos", "Finanzas", "Configuracion"]) {
  if (!opciones.some((o) => o.trim() === esperada)) comprobar(`El menu trae ${esperada}`, false, opciones.join(", "));
}
comprobar("El menu trae las mismas opciones que en la computadora", opciones.length >= 15, `${opciones.length} opciones`);
comprobar("El menu muestra el nombre del colegio", (await menu(admin).textContent()).includes("Demo"));
comprobar("Marca la pantalla actual", (await menu(admin).locator('[aria-current="page"]').textContent())?.trim() === "Panel");

await admin.keyboard.press("Escape");
comprobar("Esc cierra el menu", !(await menu(admin).isVisible()));

await boton.click();
await admin.getByRole("button", { name: "Cerrar menu" }).click();
comprobar("La X cierra el menu", !(await menu(admin).isVisible()));

await boton.click();
await admin.mouse.click(380, 400);
comprobar("Tocar fuera cierra el menu", !(await menu(admin).isVisible()));

await boton.click();
await menu(admin).getByRole("link", { name: "Alumnos", exact: true }).click();
await admin.waitForURL("**/panel/alumnos", { timeout: 15000 });
comprobar("Elegir una opcion lleva a esa pantalla", admin.url().endsWith("/panel/alumnos"));
comprobar("Y el menu se cierra solo", !(await menu(admin).isVisible()));

await boton.click();
comprobar("Marca la pantalla en la que estas", (await menu(admin).locator('[aria-current="page"]').textContent())?.trim() === "Alumnos");
await admin.keyboard.press("Escape");

// Ninguna pantalla debe salirse a lo ancho (las tablas se desplazan dentro).
for (const ruta of [
  "/panel", "/panel/alumnos", "/panel/personal", "/panel/materias", "/panel/grupos", "/panel/documentos",
  "/panel/documentos/machotes", "/panel/horarios", "/panel/asistencia", "/panel/calificaciones",
  "/panel/boletas", "/panel/finanzas", "/panel/nomina", "/panel/academico", "/panel/configuracion", "/panel/bitacora",
]) {
  await admin.goto(`${BASE}${ruta}`);
  const extra = await sobrante(admin);
  comprobar(`${ruta} cabe a lo ancho del celular`, extra <= 1, `${extra}px de mas`);
}

await admin.goto(`${BASE}/panel`);
await boton.click();
await menu(admin).getByRole("link", { name: /Cambiar mi contrasena/ }).click();
await admin.waitForURL("**/panel/cambiar-password", { timeout: 15000 });
comprobar("Desde el menu se llega a cambiar la contrasena", admin.url().endsWith("/panel/cambiar-password"));

// ---------------- Alumno ----------------
const alumno = await entrar("2026-0001", "Demo1234");
await alumno.getByRole("button", { name: "Abrir menu" }).click();
const delAlumno = await menu(alumno).getByRole("link").allTextContents();
comprobar("El alumno ve su menu en el celular", delAlumno.some((o) => o.includes("Mis calificaciones")) && delAlumno.some((o) => o.includes("Mis documentos")));
comprobar("Y no ve opciones de administracion", !delAlumno.some((o) => o.trim() === "Alumnos" || o.trim() === "Finanzas"));
await menu(alumno).getByRole("link", { name: "Mi horario" }).click();
await alumno.waitForURL("**/panel/mi-horario", { timeout: 15000 });
comprobar("El alumno navega desde el menu", alumno.url().endsWith("/panel/mi-horario"));
for (const ruta of ["/panel/mi-horario", "/panel/mis-calificaciones", "/panel/estado-de-cuenta", "/panel/mis-documentos"]) {
  await alumno.goto(`${BASE}${ruta}`);
  const extra = await sobrante(alumno);
  comprobar(`${ruta} cabe a lo ancho del celular`, extra <= 1, `${extra}px de mas`);
}

// ---------------- Docente ----------------
const docente = await entrar("docente", "Demo1234");
await docente.getByRole("button", { name: "Abrir menu" }).click();
const delDocente = await menu(docente).getByRole("link").allTextContents();
comprobar("El docente ve su menu en el celular", delDocente.some((o) => o.includes("Mis clases")));

// ---------------- Computadora ----------------
const escritorio = await entrar("admin", "Demo1234", { viewport: { width: 1280, height: 800 } });
comprobar("En la computadora sigue el menu lateral", await escritorio.locator("aside").isVisible());
comprobar("Y no aparece el boton del celular", !(await escritorio.getByRole("button", { name: "Abrir menu" }).isVisible()));

await navegador.close();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DEL MENU EN CELULAR PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
