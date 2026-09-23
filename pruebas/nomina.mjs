import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3000";
const db = new PrismaClient();
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const limpio = async (p) => (await p.textContent("body")).replace(/\s+/g, " ");
const numero = (valor) => (valor == null ? 0 : Number(valor.toString()));

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await navegador.newPage();
p.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));

await p.goto(`${BASE}/acceso`);
await p.getByLabel(/^Usuario, matricula o correo\*?$/).fill("admin");
await p.getByLabel(/^Contrasena\*?$/).fill("Demo1234");
await p.getByRole("button", { name: "Entrar" }).click();
await p.waitForURL("**/panel", { timeout: 20000 });

// ---------------- Conceptos de nomina ----------------
await p.goto(`${BASE}/panel/nomina/conceptos`);
const catalogo = await limpio(p);
comprobar("Abre el catalogo de nomina", catalogo.includes("Conceptos de nomina"));
comprobar("Avisa que no calcula tablas oficiales",
  catalogo.includes("no calcula las tablas oficiales"));
comprobar("Trae los conceptos de la demostracion", catalogo.includes("Bono de puntualidad"));

await p.getByLabel(/^Clave\*?$/).fill("PRIMA");
await p.getByLabel(/^Nombre del concepto\*?$/).fill("Prima de antiguedad");
await p.getByLabel(/^Tipo$/).selectOption("PERCEPCION");
await p.getByLabel(/^Valor\*?$/).fill("300");
await p.getByRole("button", { name: "Crear concepto" }).click();
await p.waitForTimeout(2500);
comprobar("Crea un concepto propio", (await limpio(p)).includes("Prima de antiguedad creado"));

await p.goto(`${BASE}/panel/nomina/conceptos`);
await p.getByLabel(/^Clave\*?$/).fill("MAL");
await p.getByLabel(/^Nombre del concepto\*?$/).fill("Porcentaje imposible");
await p.getByLabel(/^Como se calcula$/).selectOption("PORCENTAJE");
await p.getByLabel(/^Valor\*?$/).fill("150");
await p.getByRole("button", { name: "Crear concepto" }).click();
await p.waitForTimeout(2000);
comprobar("Rechaza un porcentaje mayor a 100",
  (await limpio(p)).includes("no puede pasar de 100"));

// ---------------- Periodos ----------------
await p.goto(`${BASE}/panel/nomina`);
comprobar("Avisa del personal sin salario base",
  (await limpio(p)).includes("sin salario base"));

async function crearPeriodo(nombre, inicio, fin, pago) {
  await p.goto(`${BASE}/panel/nomina`);
  await p.getByLabel(/^Nombre del periodo\*?$/).fill(nombre);
  await p.getByLabel(/^Desde\*?$/).fill(inicio);
  await p.getByLabel(/^Hasta\*?$/).fill(fin);
  await p.getByLabel(/^Fecha de pago\*?$/).fill(pago);
  await p.getByRole("button", { name: "Crear periodo" }).click();
  await p.waitForTimeout(3000);
}

await crearPeriodo("Fechas al reves", "2026-09-30", "2026-09-01", "2026-09-30");
comprobar("Rechaza un periodo con las fechas al reves",
  (await limpio(p)).includes("no puede ser anterior a la de inicio"));

await crearPeriodo("Septiembre 2026", "2026-09-01", "2026-09-30", "2026-09-30");
comprobar("Crea el periodo y abre su pantalla", /\/panel\/nomina\/\d+/.test(p.url()), p.url());
const urlPeriodo = p.url();

await crearPeriodo("Traslape", "2026-09-15", "2026-10-15", "2026-10-15");
comprobar("Rechaza un periodo que se encima con otro",
  (await limpio(p)).includes("se encima con el periodo"));

// ---------------- Calculo ----------------
await p.goto(urlPeriodo);
comprobar("Explica como se prorratea el sueldo",
  (await limpio(p)).includes("se prorratea"));

await p.getByRole("button", { name: "Calcular nomina del periodo" }).click();
await p.waitForTimeout(4000);
const trasCalculo = await limpio(p);
comprobar("Calcula la nomina", trasCalculo.includes("recibo(s) nuevos"));

const docente = await db.empleado.findUnique({ where: { numeroEmpleado: "DOC-001" } });
const periodoId = Number(urlPeriodo.split("/").pop());
const reciboDocente = await db.reciboNomina.findUnique({
  where: { periodoId_empleadoId: { periodoId, empleadoId: docente.id } },
  include: { detalles: { include: { concepto: true } } },
});

// Salario 18000, 30 dias base, periodo de 30 dias -> sueldo del periodo 18000.
// Percepciones automaticas: bono 500 + prima 300 -> total 18800.
// Deducciones: retencion 10% de 18000 = 1800, mas fondo de ahorro 200 -> 2000.
comprobar("Las percepciones son las esperadas",
  numero(reciboDocente.totalPercepciones) === 18800,
  `${numero(reciboDocente.totalPercepciones)}`);
comprobar("Las deducciones son las esperadas",
  numero(reciboDocente.totalDeducciones) === 2000,
  `${numero(reciboDocente.totalDeducciones)}`);
comprobar("El neto cuadra", numero(reciboDocente.neto) === 16800, `${numero(reciboDocente.neto)}`);
comprobar("El recibo guarda sus lineas", reciboDocente.detalles.length === 4,
  `${reciboDocente.detalles.length} lineas`);
comprobar("Ninguna linea automatica se marca como manual",
  reciboDocente.detalles.every((d) => d.manual === false));

// Recalcular no duplica
await p.goto(urlPeriodo);
await p.getByRole("button", { name: "Calcular nomina del periodo" }).click();
await p.waitForTimeout(4000);
const recibosTras = await db.reciboNomina.count({ where: { periodoId } });
const empleadosActivos = await db.empleado.count({ where: { estado: "ACTIVO" } });
comprobar("Recalcular no duplica recibos", recibosTras === empleadosActivos,
  `${recibosTras} recibos, ${empleadosActivos} empleados`);

// ---------------- Ajuste manual ----------------
await p.goto(`${BASE}/panel/nomina/recibo/${reciboDocente.id}`);
const vistaRecibo = await limpio(p);
comprobar("El recibo muestra el sueldo del periodo", vistaRecibo.includes("Sueldo del periodo"));
comprobar("El recibo separa percepciones y deducciones",
  vistaRecibo.includes("Percepciones") && vistaRecibo.includes("Deducciones"));
comprobar("El recibo muestra el neto", vistaRecibo.includes("$16,800.00"));

await p.getByLabel(/^Concepto\*?$/).selectOption({ label: "Prima de antiguedad (percepcion)" });
await p.getByLabel(/^Importe\*?$/).fill("1000");
await p.getByRole("button", { name: "Agregar al recibo" }).click();
await p.waitForTimeout(3000);

const conAjuste = await db.reciboNomina.findUnique({ where: { id: reciboDocente.id } });
comprobar("El ajuste sube las percepciones",
  numero(conAjuste.totalPercepciones) === 19800, `${numero(conAjuste.totalPercepciones)}`);
comprobar("El ajuste no toca las deducciones",
  numero(conAjuste.totalDeducciones) === 2000, `${numero(conAjuste.totalDeducciones)}`);
comprobar("El neto sube con el ajuste", numero(conAjuste.neto) === 17800,
  `${numero(conAjuste.neto)}`);

const lineaManual = await db.detalleReciboNomina.findFirst({
  where: { reciboId: reciboDocente.id, manual: true },
});
comprobar("El ajuste queda marcado como manual", lineaManual != null);

// Recalcular conserva el ajuste capturado a mano
await p.goto(urlPeriodo);
await p.getByRole("button", { name: "Calcular nomina del periodo" }).click();
await p.waitForTimeout(4000);
const trasRecalculo = await db.reciboNomina.findUnique({ where: { id: reciboDocente.id } });
// Aunque el ajuste use un concepto que tambien aplica automaticamente, la
// bandera de manual lo distingue y el recalculo lo respeta.
comprobar("Recalcular conserva el ajuste manual",
  numero(trasRecalculo.neto) === 17800, `${numero(trasRecalculo.neto)}`);

// Quitar el ajuste
await p.goto(`${BASE}/panel/nomina/recibo/${reciboDocente.id}`);
const quitar = p.getByRole("button", { name: "quitar" });
await quitar.last().click();
await p.waitForTimeout(3000);
const sinAjuste = await db.reciboNomina.findUnique({ where: { id: reciboDocente.id } });
comprobar("Quitar el ajuste devuelve el neto", numero(sinAjuste.neto) === 16800,
  `${numero(sinAjuste.neto)}`);

// ---------------- Autorizar y pagar ----------------
await p.goto(urlPeriodo);
await p.getByRole("button", { name: /^Autorizar los \d+ recibo/ }).click();
await p.waitForTimeout(3500);
comprobar("Autoriza los recibos", (await limpio(p)).includes("Se autorizaron"));

const autorizados = await db.reciboNomina.count({ where: { periodoId, estado: "AUTORIZADO" } });
comprobar("En la base quedan autorizados", autorizados === empleadosActivos, `${autorizados}`);

await p.goto(urlPeriodo);
await p.getByRole("button", { name: "Calcular nomina del periodo" }).click();
await p.waitForTimeout(4000);
comprobar("Recalcular respeta los recibos autorizados",
  (await limpio(p)).includes("sin tocar por estar autorizados"));

await p.goto(urlPeriodo);
await p.getByRole("button", { name: "Marcar el periodo como pagado" }).click();
await p.waitForTimeout(3500);
comprobar("Marca el periodo como pagado", (await limpio(p)).includes("Periodo pagado"));

const periodoFinal = await db.periodoNomina.findUnique({ where: { id: periodoId } });
const pagados = await db.reciboNomina.findMany({ where: { periodoId, estado: "PAGADO" } });
comprobar("El periodo queda PAGADO", periodoFinal.estado === "PAGADO", periodoFinal.estado);
comprobar("Los recibos guardan metodo y fecha de pago",
  pagados.length === empleadosActivos && pagados.every((r) => r.metodoPago && r.fechaPago),
  `${pagados.length} pagados`);
comprobar("Se guarda quien cerro el periodo", periodoFinal.cerradoPor != null);

await p.goto(urlPeriodo);
comprobar("Un periodo pagado ya no ofrece recalcular",
  (await p.getByRole("button", { name: "Calcular nomina del periodo" }).count()) === 0);

// ---------------- Cancelacion ----------------
await p.goto(`${BASE}/panel/nomina/recibo/${reciboDocente.id}`);
await p.getByRole("button", { name: "Cancelar recibo" }).click();
await p.waitForTimeout(2000);
comprobar("Exige motivo para cancelar un recibo",
  (await limpio(p)).includes("Escribe el motivo"));

await p.getByRole("textbox", { name: "Motivo de la cancelacion del recibo" }).fill("Error de captura");
await p.getByRole("button", { name: "Cancelar recibo" }).click();
await p.waitForTimeout(3000);
const cancelado = await db.reciboNomina.findUnique({ where: { id: reciboDocente.id } });
comprobar("Cancela el recibo", cancelado.estado === "CANCELADO", cancelado.estado);
comprobar("Guarda el motivo en el recibo", cancelado.observaciones === "Error de captura",
  cancelado.observaciones ?? "vacio");

// ---------------- Bitacora y permisos ----------------
await p.goto(`${BASE}/panel/bitacora`);
const bitacora = await limpio(p);
comprobar("La bitacora registro el calculo", bitacora.includes("PeriodoNomina"));
comprobar("La bitacora registro la cancelacion", bitacora.includes("ReciboNomina"));

const contextoDocente = await navegador.newContext();
const paginaDocente = await contextoDocente.newPage();
await paginaDocente.goto(`${BASE}/acceso`);
await paginaDocente.getByLabel(/^Usuario, matricula o correo\*?$/).fill("docente");
await paginaDocente.getByLabel(/^Contrasena\*?$/).fill("Demo1234");
await paginaDocente.getByRole("button", { name: "Entrar" }).click();
await paginaDocente.waitForURL("**/panel", { timeout: 20000 });
await paginaDocente.goto(`${BASE}/panel/nomina`);
comprobar("El docente no entra a Nomina",
  !paginaDocente.url().includes("/panel/nomina"), paginaDocente.url());

// ---------------- Modulo desactivable ----------------
await p.goto(`${BASE}/panel/configuracion`);
await p.locator('select[name="nomina.activa"]').selectOption("false");
await p
  .locator('select[name="nomina.activa"]')
  .locator("xpath=ancestor::form")
  .getByRole("button", { name: "Guardar cambios" })
  .click();
await p.waitForTimeout(3000);
await p.goto(`${BASE}/panel/nomina`);
comprobar("Se puede apagar todo el modulo desde Configuracion",
  (await limpio(p)).includes("modulo de nomina esta desactivado"));

await navegador.close();
await db.$disconnect();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DE NOMINA PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
