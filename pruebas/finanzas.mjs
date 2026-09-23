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

await entrar(admin, "admin", "Demo1234");

// ---------------- Catalogo de cobros ----------------
await admin.goto(`${BASE}/panel/finanzas/conceptos`);
comprobar("Abre el catalogo de conceptos", (await limpio(admin)).includes("Conceptos de cobro"));

// Se desactivan los conceptos que trae la demostracion para probar con los
// propios. Cada clic recarga la tabla, asi que se toma siempre el primero que
// quede y se espera a que desaparezca.
for (let intento = 0; intento < 20; intento++) {
  const boton = admin.getByRole("button", { name: "desactivar" }).first();
  if ((await boton.count()) === 0) break;
  await boton.click();
  await admin.waitForTimeout(1500);
}
comprobar("Desactiva los conceptos de la demostracion",
  (await admin.getByRole("button", { name: "desactivar" }).count()) === 0);

async function crearConcepto({ clave, motivo, monto, periodicidad, dia, primera, cuantos }) {
  await admin.goto(`${BASE}/panel/finanzas/conceptos`);
  await admin.getByLabel(/^Clave\*?$/).fill(clave);
  await admin.getByLabel(/^Motivo del cobro\*?$/).fill(motivo);
  await admin.getByLabel(/^Monto\*?$/).fill(String(monto));
  await admin.getByLabel(/^Periodicidad$/).selectOption(periodicidad);
  if (dia != null) await admin.getByLabel(/^Dia de vencimiento$/).fill(String(dia));
  if (primera) await admin.getByLabel(/^Fecha del primer cargo$/).fill(primera);
  if (cuantos != null) await admin.getByLabel(/^Cuantos cargos$/).fill(String(cuantos));
  await admin.getByRole("button", { name: "Crear concepto" }).click();
  await admin.waitForTimeout(2500);
  return limpio(admin);
}

const trasColegiatura = await crearConcepto({
  clave: "COL-PRB",
  motivo: "Colegiatura de prueba",
  monto: 1000,
  periodicidad: "MENSUAL",
  dia: 5,
  primera: "2026-08-05",
  cuantos: 3,
});
comprobar("Crea un concepto con motivo, monto y tiempo propios",
  trasColegiatura.includes("Concepto Colegiatura de prueba creado"));
comprobar("Calcula cuantos cargos y cuando vence el primero",
  trasColegiatura.includes("3 cargo(s)"), trasColegiatura.slice(trasColegiatura.indexOf("Mensual"), trasColegiatura.indexOf("Mensual") + 60));

const trasUnico = await crearConcepto({
  clave: "INS-PRB",
  motivo: "Inscripcion de prueba",
  monto: 2000,
  periodicidad: "UNICO",
  dia: 20,
  primera: "2026-09-20",
});
comprobar("Crea un cobro de una sola vez", trasUnico.includes("Concepto Inscripcion de prueba creado"));

// Validaciones del catalogo
await admin.goto(`${BASE}/panel/finanzas/conceptos`);
await admin.getByLabel(/^Clave\*?$/).fill("MAL-1");
await admin.getByLabel(/^Motivo del cobro\*?$/).fill("Cobro invalido");
await admin.getByLabel(/^Monto\*?$/).fill("100");
await admin.evaluate(() => {
  const campo = document.querySelector('input[name="diaVencimiento"]');
  if (campo) {
    campo.removeAttribute("max");
    campo.value = "40";
  }
});
await admin.getByRole("button", { name: "Crear concepto" }).click();
await admin.waitForTimeout(2000);
comprobar("Rechaza un dia de vencimiento invalido",
  (await limpio(admin)).includes("entre 1 y 31"));

// Regla de recargo
await admin.goto(`${BASE}/panel/finanzas/conceptos`);
await admin.getByLabel(/^Nombre\*?$/).fill("Recargo de prueba");
await admin.getByLabel(/^Valor\*?$/).fill("10");
await admin.getByLabel(/^Dias de gracia$/).fill("0");
await admin.getByRole("button", { name: "Crear regla" }).click();
await admin.waitForTimeout(2500);
comprobar("Crea la regla de recargo", (await limpio(admin)).includes("Regla creada"));

// ---------------- Becas ----------------
await admin.goto(`${BASE}/panel/finanzas/becas`);
await admin.getByLabel(/^Nombre\*?$/).first().fill("Beca de prueba 50%");
await admin.getByLabel(/^Valor\*?$/).first().fill("50");
await admin.getByRole("button", { name: "Crear descuento" }).click();
await admin.waitForTimeout(2500);
comprobar("Crea una beca", (await limpio(admin)).includes("Descuento creado"));

await admin.goto(`${BASE}/panel/finanzas/becas`);
await admin.getByLabel(/^Alumno\*?$/).selectOption({ index: 1 });
const alumnoBecado = await admin.getByLabel(/^Alumno\*?$/).locator("option:checked").textContent();
await admin.getByLabel(/^Beca o descuento\*?$/).selectOption({ index: 1 });
await admin.getByRole("button", { name: "Asignar beca" }).click();
await admin.waitForTimeout(2500);
comprobar("Asigna la beca a un alumno", (await limpio(admin)).includes("asignada a"));

// ---------------- Generacion de cargos ----------------
await admin.goto(`${BASE}/panel/finanzas`);
await admin.getByRole("button", { name: "Ver que se generaria" }).click();
await admin.waitForTimeout(3500);
const vistaPrevia = await limpio(admin);
comprobar("La vista previa calcula los cargos", vistaPrevia.includes("Se generarian"));
comprobar("La vista previa aplica la beca", vistaPrevia.includes("-500"));
comprobar("La vista previa respeta las fechas configuradas", vistaPrevia.includes("2026-08-05"));

await admin.getByRole("button", { name: "Generar cargos" }).click();
await admin.waitForTimeout(5000);
comprobar("Genera los cargos", (await limpio(admin)).includes("cargo(s) generados"));

await admin.goto(`${BASE}/panel/finanzas`);
await admin.getByRole("button", { name: "Generar cargos" }).click();
await admin.waitForTimeout(5000);
const segundaVez = await limpio(admin);
comprobar("Generar dos veces no duplica",
  /Se omitieron [1-9]\d* que ya existian/.test(segundaVez),
  segundaVez.slice(segundaVez.indexOf("Listo:"), segundaVez.indexOf("Listo:") + 90));

// ---------------- Estado de cuenta y caja ----------------
const matricula = (alumnoBecado ?? "").trim().split(" ")[0];
await admin.goto(`${BASE}/panel/finanzas?q=${matricula}`);
await admin.getByRole("link", { name: "Estado de cuenta" }).first().click();
await admin.waitForURL(/\/panel\/finanzas\/alumno\/\d+/, { timeout: 15000 });
const urlCuenta = admin.url();
const cuenta = await limpio(admin);
comprobar("Abre el estado de cuenta del alumno", cuenta.includes("Cargos"));
comprobar("Los cargos traen el motivo configurado", cuenta.includes("Colegiatura de prueba"));
comprobar("La beca se refleja en el cargo", cuenta.includes("-$500.00"));

// Pago parcial
await admin.getByLabel(/^Monto recibido\*?$/).fill("200");
await admin.getByRole("button", { name: "Registrar pago" }).click();
await admin.waitForTimeout(3000);
const trasParcial = await limpio(admin);
comprobar("Registra un pago parcial", trasParcial.includes("Pago P-"));
comprobar("El cargo queda parcial", trasParcial.includes("parcial"));

// Pago que cubre todo lo demas
await admin.getByRole("button", { name: "Cubrir todo" }).click();
await admin.waitForTimeout(500);
await admin.getByRole("button", { name: "Registrar pago" }).click();
await admin.waitForTimeout(3500);
const trasTotal = await limpio(admin);
comprobar("Cubre el resto del saldo", trasTotal.includes("Saldo$0.00"),
  trasTotal.slice(trasTotal.indexOf("Cargado"), trasTotal.indexOf("Cargado") + 80));

// Recibo
await admin.getByRole("link", { name: /^Ver recibo/ }).first().click();
await admin.waitForURL(/\/panel\/finanzas\/recibo\/\d+/, { timeout: 15000 });
const recibo = await limpio(admin);
comprobar("El recibo trae el encabezado del colegio", recibo.includes("Colegio de Demostracion"));
comprobar("El recibo lista los conceptos pagados", recibo.includes("Colegiatura de prueba"));
comprobar("El recibo lleva la leyenda configurada",
  recibo.includes("no tiene validez fiscal"));

// Cancelacion de pago
await admin.goto(urlCuenta);
await admin.waitForTimeout(1200);
await admin.getByRole("textbox", { name: "Motivo de la cancelacion" }).first().fill("Pago duplicado");
await admin.getByRole("button", { name: "Cancelar pago" }).first().click();
await admin.waitForTimeout(3000);
const trasCancelar = await limpio(admin);
// Al cancelarse, el formulario de cancelacion desaparece de esa fila y el pago
// queda marcado; ese cambio es la confirmacion visible.
comprobar("Cancela un pago", trasCancelar.includes("Motivo: Pago duplicado"));
comprobar("El saldo se restaura al cancelar", !trasCancelar.includes("Saldo$0.00"),
  trasCancelar.slice(trasCancelar.indexOf("Cargado"), trasCancelar.indexOf("Cargado") + 80));

// Cargo manual con motivo libre
await admin.getByLabel(/^Motivo del cargo\*?$/).fill("Reposicion de credencial");
await admin.getByLabel(/^Monto\*?$/).last().fill("350");
await admin.getByLabel(/^Vence el\*?$/).fill("2026-11-15");
await admin.getByRole("button", { name: "Agregar cargo" }).click();
await admin.waitForTimeout(3000);
comprobar("Crea un cargo manual con motivo libre",
  (await limpio(admin)).includes("Reposicion de credencial"));

// Convenio de pago
await admin.getByLabel(/^Parcialidades\*?$/).fill("3");
await admin.getByLabel(/^Primera parcialidad\*?$/).fill("2026-10-01");
await admin.getByRole("button", { name: "Crear convenio" }).click();
await admin.waitForTimeout(3000);
comprobar("Crea un convenio en parcialidades",
  (await limpio(admin)).includes("parcialidades de"));

// ---------------- Recargos ----------------
await admin.goto(`${BASE}/panel/finanzas`);
await admin.getByRole("button", { name: "Aplicar recargos a los cargos vencidos" }).click();
await admin.waitForTimeout(4000);
const trasRecargos = await limpio(admin);
comprobar("Aplica recargos a lo vencido", trasRecargos.includes("Se revisaron"));
comprobar("Los recargos suman algo", /Diferencia en recargos: [1-9]/.test(trasRecargos),
  trasRecargos.slice(trasRecargos.indexOf("Diferencia"), trasRecargos.indexOf("Diferencia") + 45));

await admin.getByRole("button", { name: "Aplicar recargos a los cargos vencidos" }).click();
await admin.waitForTimeout(4000);
comprobar("Aplicar recargos dos veces no los duplica",
  /Diferencia en recargos: 0/.test(await limpio(admin)));

// ---------------- Portal del alumno ----------------
const contextoAlumno = await navegador.newContext();
const alumno = await contextoAlumno.newPage();
await entrar(alumno, "2026-0001", "Demo1234");
const panelAlumno = await limpio(alumno);
comprobar("El alumno ve sus accesos", panelAlumno.includes("Estado de cuenta"));

await alumno.goto(`${BASE}/panel/estado-de-cuenta`);
const cuentaAlumno = await limpio(alumno);
comprobar("El alumno ve su estado de cuenta", cuentaAlumno.includes("Mi estado de cuenta"));
comprobar("El alumno ve sus cargos", cuentaAlumno.includes("Colegiatura de prueba"));

await alumno.goto(`${BASE}/panel/mi-horario`);
comprobar("El alumno ve su horario", (await limpio(alumno)).includes("Mi horario"));

await alumno.goto(`${BASE}/panel/mi-asistencia`);
comprobar("El alumno ve su asistencia", (await limpio(alumno)).includes("Mi asistencia"));

await alumno.goto(`${BASE}/panel/mis-calificaciones`);
comprobar("El alumno ve sus calificaciones", (await limpio(alumno)).includes("Mis calificaciones"));

await alumno.goto(`${BASE}/panel/finanzas`);
comprobar("El alumno no entra a Finanzas", !alumno.url().includes("/panel/finanzas"), alumno.url());

// ---------------- Bloqueo por adeudo ----------------
await admin.goto(`${BASE}/panel/configuracion`);
await admin.locator('select[name="finanzas.bloquear_por_adeudo"]').selectOption("true");
await admin.locator('input[name="finanzas.dias_adeudo_para_bloqueo"]').fill("0");
await admin
  .locator('select[name="finanzas.bloquear_por_adeudo"]')
  .locator("xpath=ancestor::form")
  .getByRole("button", { name: "Guardar cambios" })
  .click();
await admin.waitForTimeout(3000);
comprobar("Activa el bloqueo por adeudo", (await limpio(admin)).includes("Se guardaron"));

await alumno.goto(`${BASE}/panel/mis-calificaciones`);
comprobar("El adeudo bloquea la boleta del alumno",
  (await limpio(alumno)).includes("bloqueada por un adeudo"));

await admin.goto(`${BASE}/panel/configuracion`);
await admin.locator('select[name="finanzas.bloquear_por_adeudo"]').selectOption("false");
await admin
  .locator('select[name="finanzas.bloquear_por_adeudo"]')
  .locator("xpath=ancestor::form")
  .getByRole("button", { name: "Guardar cambios" })
  .click();
await admin.waitForTimeout(3000);
await alumno.goto(`${BASE}/panel/mis-calificaciones`);
comprobar("Al desactivarlo, el alumno vuelve a ver sus calificaciones",
  !(await limpio(alumno)).includes("bloqueada por un adeudo"));

await navegador.close();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DE FINANZAS PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
