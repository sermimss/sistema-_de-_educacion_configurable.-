import { chromium } from "playwright";

// Plataforma multicolegio de punta a punta. Requiere una base recien migrada
// SIN datos y el servidor en modo plataforma:
//
//   MODO_PLATAFORMA=1 PLATAFORMA_CLAVE_ARRANQUE=clave-de-arranque-de-prueba npm start

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const CLAVE_ARRANQUE = process.env.PLATAFORMA_CLAVE_ARRANQUE ?? "clave-de-arranque-de-prueba";
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const limpio = async (p) => (await p.textContent("body")).replace(/\s+/g, " ");

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const nueva = async () => {
  const contexto = await navegador.newContext();
  const pagina = await contexto.newPage();
  pagina.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));
  return pagina;
};

// ---------- La pregunta de entrada ----------
const visita = await nueva();
await visita.goto(`${BASE}/`);
const entrada = await limpio(visita);
comprobar("La entrada pregunta si ya tienes colegio", entrada.includes("Ya tengo un colegio registrado"));
comprobar("La entrada ofrece contratar el servicio", entrada.includes("Quiero contratar el servicio"));

await visita.goto(`${BASE}/instalacion`);
comprobar("Sin codigo de alta no se abre el asistente", visita.url().endsWith("/alta"), visita.url());

await visita.goto(`${BASE}/alta`);
await visita.getByLabel(/^Codigo de alta\*?$/).fill("ALTA-AAAA-BBBB-CCCC");
await visita.getByRole("button", { name: "Comenzar la configuracion" }).click();
await visita.waitForTimeout(1500);
comprobar("Rechaza un codigo inventado", (await limpio(visita)).includes("no es valido"));

await visita.goto(`${BASE}/noexiste`);
comprobar("Una direccion que no existe lo dice", (await limpio(visita)).includes("No encontramos ese colegio"));

// ---------- El dueno de la plataforma ----------
const dueno = await nueva();
await dueno.goto(`${BASE}/plataforma`);
await dueno.getByLabel(/^Clave de arranque\*?$/).fill("clave-equivocada-123");
await dueno.getByLabel(/^Usuario\*?$/).fill("dueno");
await dueno.getByLabel(/^Contrasena\*?$/).fill("DuenoPrueba2026");
await dueno.getByLabel(/^Confirma la contrasena\*?$/).fill("DuenoPrueba2026");
await dueno.getByRole("button", { name: "Crear mi cuenta de dueno" }).click();
await dueno.waitForTimeout(1500);
comprobar("Sin la clave de arranque nadie se adueña de la plataforma",
  (await limpio(dueno)).includes("clave de arranque no es correcta"));

await dueno.getByLabel(/^Clave de arranque\*?$/).fill(CLAVE_ARRANQUE);
await dueno.getByLabel(/^Usuario\*?$/).fill("dueno");
await dueno.getByLabel(/^Contrasena\*?$/).fill("DuenoPrueba2026");
await dueno.getByLabel(/^Confirma la contrasena\*?$/).fill("DuenoPrueba2026");
await dueno.getByRole("button", { name: "Crear mi cuenta de dueno" }).click();
await dueno.waitForURL("**/plataforma/panel", { timeout: 15000 });
comprobar("Crea la cuenta del dueno", (await limpio(dueno)).includes("Administracion de la plataforma"));

async function generarCodigo(etiqueta) {
  await dueno.goto(`${BASE}/plataforma/panel`);
  await dueno.getByLabel("Para quien es").fill(etiqueta);
  await dueno.getByRole("button", { name: "Generar codigo de alta" }).click();
  await dueno.waitForSelector("[data-codigo-alta]", { timeout: 15000 });
  return (await dueno.textContent("[data-codigo-alta]")).trim();
}
const codigoV = await generarCodigo("Colegio Vanguardia");
comprobar("Genera un codigo de alta", /^ALTA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codigoV), codigoV);
await dueno.reload();
comprobar("El codigo no se vuelve a mostrar completo", !(await limpio(dueno)).includes(codigoV));

// ---------- Alta del primer colegio ----------
async function altaColegio(p, { codigo, nombre, corto, direccion, password }) {
  await p.goto(`${BASE}/`);
  await p.getByRole("link", { name: "Dar de alta mi colegio" }).click();
  await p.waitForURL("**/alta");
  await p.getByLabel(/^Codigo de alta\*?$/).fill(codigo.toLowerCase());
  await p.getByRole("button", { name: "Comenzar la configuracion" }).click();
  await p.waitForURL("**/instalacion", { timeout: 15000 });
  await p.getByLabel("Nombre de la institucion").fill(nombre);
  await p.getByLabel("Nombre corto").fill(corto);
  const sugerida = await p.getByLabel(/^Direccion web del colegio\*?$/).inputValue();
  if (direccion) await p.getByLabel(/^Direccion web del colegio\*?$/).fill(direccion);
  for (let i = 0; i < 6; i++) {
    await p.getByRole("button", { name: "Continuar" }).click();
    await p.waitForTimeout(250);
  }
  await p.getByLabel("Nombre de usuario").fill("direccion");
  await p.getByLabel("Correo electronico").fill(`direccion@${corto.toLowerCase()}.mx`);
  await p.getByLabel("Nombre(s)").fill("Maria");
  await p.getByLabel("Apellido paterno").fill("Serrano");
  await p.getByLabel("Contrasena").fill(password);
  await p.getByRole("button", { name: "Continuar" }).click();
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: "Instalar sistema" }).click();
  await Promise.race([
    p.waitForSelector("[data-direccion-colegio]", { timeout: 120000 }),
    p.waitForSelector("text=ya la usa otro colegio", { timeout: 120000 }),
  ]).catch(() => {});
  const direccionFinal = await p.locator("[data-direccion-colegio]").textContent().catch((e) => `ERROR ${e.message.slice(0, 150)}`);
  return { sugerida, texto: await limpio(p), direccionFinal: (direccionFinal ?? "").trim() };
}

const cliente1 = await nueva();
const alta1 = await altaColegio(cliente1, {
  codigo: codigoV, nombre: "Colegio Vanguardia", corto: "Vanguardia", password: "Vanguardia2026",
});
comprobar("Propone la direccion a partir del nombre", alta1.sugerida === "vanguardia", alta1.sugerida);
comprobar("Al terminar entrega la direccion propia del colegio",
  alta1.direccionFinal === `${BASE}/vanguardia`, alta1.direccionFinal);
comprobar("Avisa que se abre al confirmar el pago", alta1.texto.includes("se abrira en cuanto se confirme el pago"));

await cliente1.goto(`${BASE}/vanguardia`);
const pendiente = await limpio(cliente1);
comprobar("La direccion lleva al acceso del colegio", cliente1.url().includes("/acceso") && pendiente.includes("Colegio Vanguardia"));
comprobar("Sin pago no deja iniciar sesion",
  pendiente.includes("se abrira en cuanto se confirme el pago") && !pendiente.includes("Usuario, matricula o correo"));

const reuso = await nueva();
await reuso.goto(`${BASE}/alta`);
await reuso.getByLabel(/^Codigo de alta\*?$/).fill(codigoV);
await reuso.getByRole("button", { name: "Comenzar la configuracion" }).click();
await reuso.waitForTimeout(1500);
comprobar("Un codigo usado no sirve para otro colegio", (await limpio(reuso)).includes("ya se uso"));

// ---------- El dueno lo marca como pagado ----------
await dueno.goto(`${BASE}/plataforma/panel`);
const filaV = dueno.locator('tr[data-colegio="vanguardia"]');
comprobar("El dueno ve el colegio pendiente de pago", (await filaV.textContent()).includes("pendiente de pago"));
await filaV.getByRole("button", { name: "Marcar como pagado" }).click();
await dueno.waitForTimeout(1500);
comprobar("Marcar como pagado lo activa",
  (await dueno.locator('tr[data-colegio="vanguardia"]').textContent()).includes("activo"));

async function entrar(p, direccion, usuario, password) {
  await p.goto(`${BASE}/${direccion}`);
  await p.getByLabel(/^Usuario, matricula o correo\*?$/).fill(usuario);
  await p.getByLabel(/^Contrasena\*?$/).fill(password);
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.waitForTimeout(2500);
}
await entrar(cliente1, "vanguardia", "direccion", "Vanguardia2026");
comprobar("Ya pagado, entra a su panel", cliente1.url().endsWith("/panel"), cliente1.url());
comprobar("El panel es el de su colegio", (await limpio(cliente1)).includes("Vanguardia"));

// Algo propio de Vanguardia para comprobar despues que Aurora no lo ve.
await cliente1.goto(`${BASE}/panel/materias`);
const tarjetaMateria = cliente1.locator("section").filter({ hasText: "Nueva materia" });
await tarjetaMateria.getByLabel(/^Clave\*?$/).fill("ROB-V");
await tarjetaMateria.getByLabel(/^Nombre de la materia\*?$/).fill("Robotica Vanguardia");
await cliente1.getByRole("button", { name: "Agregar materia" }).click();
await cliente1.waitForTimeout(1500);
comprobar("Vanguardia registra una materia", (await limpio(cliente1)).includes("Robotica Vanguardia"));

// ---------- Segundo colegio ----------
const codigoA = await generarCodigo("Colegio Aurora");
const cliente2 = await nueva();
const repetida = await altaColegio(cliente2, {
  codigo: codigoA, nombre: "Colegio Aurora", corto: "Aurora", direccion: "vanguardia", password: "Aurora2026xx",
});
comprobar("No deja usar la direccion de otro colegio", repetida.texto.includes("ya la usa otro colegio"));

await cliente2.goto(`${BASE}/instalacion`);
await cliente2.getByLabel("Nombre de la institucion").fill("Colegio Aurora");
await cliente2.getByLabel("Nombre corto").fill("Aurora");
await cliente2.getByLabel(/^Direccion web del colegio\*?$/).fill("panel");
await cliente2.getByRole("button", { name: "Continuar" }).click();
await cliente2.waitForTimeout(400);
comprobar("No deja usar una palabra reservada como direccion", (await limpio(cliente2)).includes("La direccion web debe"));

const alta2 = await altaColegio(cliente2, {
  codigo: codigoA, nombre: "Colegio Aurora", corto: "Aurora", password: "Aurora2026xx",
});
comprobar("Con el mismo codigo retoma el alta sin terminar", alta2.direccionFinal === `${BASE}/aurora`, alta2.direccionFinal);

await dueno.goto(`${BASE}/plataforma/panel`);
await dueno.locator('tr[data-colegio="aurora"]').getByRole("button", { name: "Marcar como pagado" }).click();
await dueno.waitForTimeout(1500);

// ---------- Cada colegio en su habitacion ----------
await entrar(cliente2, "aurora", "direccion", "Vanguardia2026");
comprobar("La contrasena de otro colegio no abre este", !cliente2.url().endsWith("/panel"));
await entrar(cliente2, "aurora", "direccion", "Aurora2026xx");
comprobar("Aurora entra con su propia cuenta (mismo usuario que Vanguardia)", cliente2.url().endsWith("/panel"));
const panelAurora = await limpio(cliente2);
comprobar("El panel de Aurora es de Aurora", panelAurora.includes("Aurora") && !panelAurora.includes("Vanguardia"));
await cliente2.goto(`${BASE}/panel/materias`);
comprobar("Aurora no ve las materias de Vanguardia", !(await limpio(cliente2)).includes("Robotica Vanguardia"));

// Cambiar a mano el colegio recordado no abre el panel de otro colegio.
await cliente1.context().addCookies([{ name: "colegio_elegido", value: "aurora", url: BASE }]);
await cliente1.goto(`${BASE}/panel`);
const trasCambio = await limpio(cliente1);
comprobar("La sesion solo abre su propio colegio", trasCambio.includes("Vanguardia") && !trasCambio.includes("Colegio Aurora"));

await cliente1.goto(`${BASE}/aurora`);
const puertaAjena = await limpio(cliente1);
comprobar("En la direccion de otro colegio pide sus credenciales",
  cliente1.url().includes("/acceso") && puertaAjena.includes("Colegio Aurora") && puertaAjena.includes("Usuario, matricula o correo"));

// ---------- La pregunta al volver ----------
const regreso = await nueva();
await regreso.goto(`${BASE}/`);
await regreso.getByLabel(/^Direccion de tu colegio\*?$/).fill(`${BASE}/aurora`);
await regreso.getByRole("button", { name: "Ir a mi colegio" }).click();
await regreso.waitForURL("**/acceso**", { timeout: 15000 });
comprobar("'Ya tengo colegio' acepta la direccion completa", (await limpio(regreso)).includes("Colegio Aurora"));
await regreso.goto(`${BASE}/`);
const segunda = await limpio(regreso);
comprobar("Al volver sin sesion hace la misma pregunta", segunda.includes("Ya tengo un colegio registrado"));
comprobar("Y recuerda a que colegio entro la ultima vez", segunda.includes("La ultima vez entraste a Colegio Aurora"));

await cliente2.goto(`${BASE}/`);
comprobar("Con la sesion abierta entra directo a su colegio", cliente2.url().endsWith("/panel"));

// ---------- Suspension ----------
await dueno.goto(`${BASE}/plataforma/panel`);
comprobar("El dueno ve cuantos alumnos tiene cada colegio",
  (await dueno.locator('tr[data-colegio="vanguardia"]').textContent()).includes("0"));
await dueno.locator('tr[data-colegio="vanguardia"]').getByRole("button", { name: "Suspender" }).click();
await dueno.waitForTimeout(1500);
await cliente1.goto(`${BASE}/vanguardia`);
await cliente1.goto(`${BASE}/panel`);
await cliente1.waitForTimeout(500);
const suspendido = await limpio(cliente1);
comprobar("Suspendido, su personal ya no entra", !cliente1.url().endsWith("/panel") && suspendido.includes("suspendido"), cliente1.url());
await cliente2.goto(`${BASE}/panel`);
comprobar("Suspender un colegio no afecta a los demas", cliente2.url().endsWith("/panel"));

const intruso = await nueva();
await intruso.goto(`${BASE}/plataforma/panel`);
comprobar("Sin cuenta de dueno no se ve el panel de la plataforma", !intruso.url().endsWith("/plataforma/panel"));

await navegador.close();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DE LA PLATAFORMA PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
