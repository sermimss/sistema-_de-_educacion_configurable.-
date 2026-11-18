import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Recuperar el acceso en un colegio (modo un colegio). Requiere una base
// recien sembrada con los datos de demostracion y DATABASE_URL de esa base
// (para el comando local de restablecer al administrador).

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const limpio = async (p) => (await p.textContent("body")).replace(/\s+/g, " ");

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const nueva = async () => {
  const p = await (await navegador.newContext()).newPage();
  p.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));
  return p;
};
async function intentarEntrar(p, usuario, password) {
  await p.goto(`${BASE}/acceso`);
  await p.getByLabel(/^Usuario, matricula o correo\*?$/).fill(usuario);
  await p.getByLabel(/^Contrasena\*?$/).fill(password);
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.waitForTimeout(2500);
  return p.url();
}
async function pedirAcceso(identificador, mensaje = "") {
  const p = await nueva();
  await p.goto(`${BASE}/acceso`);
  await p.getByRole("link", { name: "¿Olvidaste tu contrasena?" }).click();
  await p.waitForURL("**/acceso/recuperar");
  await p.getByLabel(/^Tu usuario, matricula o correo\*?$/).fill(identificador);
  if (mensaje) await p.getByLabel(/^Como te localizamos/).fill(mensaje);
  await p.getByRole("button", { name: "Pedir una contrasena nueva" }).click();
  await p.waitForTimeout(1500);
  return limpio(p);
}

// ---------------- Docente que olvido su contrasena ----------------
const respuesta = await pedirAcceso("docente", "Grupo 1A, tel 5512345678");
comprobar("El acceso tiene '¿Olvidaste tu contrasena?' y recibe la solicitud", respuesta.includes("ya recibio tu solicitud"));
const inexistente = await pedirAcceso("usuario-que-no-existe");
comprobar("Con un usuario que no existe responde lo mismo (no revela que cuentas hay)", inexistente.includes("ya recibio tu solicitud"));
await pedirAcceso("docente");

const admin = await nueva();
await intentarEntrar(admin, "admin", "Demo1234");
comprobar("El panel avisa que alguien pide acceso", (await limpio(admin)).includes("olvidaron su contrasena"));
await admin.goto(`${BASE}/panel/accesos`);
comprobar("Solicitudes de acceso aparece en el menu", (await admin.locator("aside").textContent()).includes("Solicitudes de acceso"));
const filas = admin.locator('[data-solicitud-acceso="docente"]');
comprobar("Pedirlo dos veces no duplica la solicitud", (await filas.count()) === 1);
comprobar("La bandeja muestra quien es y como localizarlo",
  (await filas.first().textContent()).includes("Hernandez") && (await filas.first().textContent()).includes("5512345678"));
comprobar("Una cuenta que no existe no llega a la bandeja", !(await limpio(admin)).includes("usuario-que-no-existe"));
await filas.first().getByRole("button", { name: "Asignar contrasena temporal" }).click();
await admin.waitForSelector("[data-contrasena-temporal]", { timeout: 15000 });
const temporal = (await admin.textContent("[data-contrasena-temporal]")).trim();
comprobar("Asigna una contrasena temporal facil de dictar", /^[A-Z]{4}-\d{4}$/.test(temporal), temporal);

const docente = await nueva();
comprobar("La contrasena anterior del docente ya no sirve", !(await intentarEntrar(docente, "docente", "Demo1234")).endsWith("/panel"));
await intentarEntrar(docente, "docente", temporal);
comprobar("Con la temporal entra y se le obliga a cambiarla", docente.url().includes("/panel/cambiar-password"), docente.url());
comprobar("La pantalla para cambiarla se muestra sin recargar", await docente.getByLabel(/^Contrasena actual\*?$/).isVisible());
await docente.locator("aside").getByRole("link", { name: "Mis clases" }).click();
await docente.waitForTimeout(2000);
comprobar("Con contrasena temporal no se puede usar el menu para saltarse el cambio",
  docente.url().includes("/panel/cambiar-password") && !(await limpio(docente)).includes("Mis clases del"), docente.url());
await docente.getByLabel(/^Contrasena actual\*?$/).fill(temporal);
await docente.getByLabel(/^Nueva contrasena\*?$/).fill("Docente2026");
await docente.getByLabel(/^Confirma la nueva contrasena\*?$/).fill("Docente2026");
await docente.getByRole("button", { name: "Cambiar contrasena" }).click();
await docente.waitForURL("**/panel", { timeout: 20000 });
comprobar("Cambia la contrasena y entra a su panel", docente.url().endsWith("/panel"));
await docente.goto(`${BASE}/panel/accesos`);
comprobar("Un docente no ve la bandeja de accesos", !docente.url().endsWith("/panel/accesos"));

// ---------------- Descartar ----------------
await pedirAcceso("2026-0002", "no fui yo");
await admin.goto(`${BASE}/panel/accesos`);
await admin.locator('[data-solicitud-acceso="2026-0002"]').getByRole("button", { name: "Descartar" }).click();
await admin.waitForTimeout(1500);
await admin.reload();
comprobar("Una solicitud descartada sale de la bandeja", (await admin.locator('[data-solicitud-acceso="2026-0002"]').count()) === 0);
const alumno = await nueva();
comprobar("Descartar no cambia la contrasena del alumno", (await intentarEntrar(alumno, "2026-0002", "Demo1234")).endsWith("/panel"));

// ---------------- Comando local para el administrador ----------------
if (!process.env.DATABASE_URL) {
  comprobar("El comando local restablece al administrador", false, "falta DATABASE_URL de la base de pruebas");
} else {
  const salida = execFileSync(process.execPath, [path.join(raiz, "scripts/restablecer-admin.mjs"), "admin"], {
    env: process.env,
    encoding: "utf8",
  });
  const temporalAdmin = salida.match(/Contrasena temporal:\s+([A-Z]{4}-\d{4})/)?.[1];
  comprobar("El comando local da usuario y contrasena temporal", Boolean(temporalAdmin) && salida.includes("Usuario:              admin"));
  const otraVez = await nueva();
  comprobar("Tras el comando, la contrasena anterior del administrador ya no sirve",
    !(await intentarEntrar(otraVez, "admin", "Demo1234")).endsWith("/panel"));
  await intentarEntrar(otraVez, "admin", temporalAdmin);
  comprobar("El administrador entra con la temporal y debe cambiarla", otraVez.url().includes("/panel/cambiar-password"));
  await admin.goto(`${BASE}/panel/accesos`);
  comprobar("El comando cierra las sesiones abiertas del administrador", !admin.url().endsWith("/panel/accesos"), admin.url());
}

await navegador.close();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DE RECUPERACION DE ACCESO PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
