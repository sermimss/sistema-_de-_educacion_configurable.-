/**
 * Verificacion a nivel de base de datos de los tres puntos que fallaron en la
 * primera corrida de la suite de finanzas. La suite normal mira la pantalla;
 * esta mira lo que quedo guardado, que es donde se veria un error de verdad.
 *
 * Requiere una base recien sembrada con SEED_DEMO=1 y el servidor arriba.
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const db = new PrismaClient();
const fallos = [];

function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const numero = (valor) => (valor == null ? 0 : Number(valor.toString()));
const limpio = async (p) => (await p.textContent("body")).replace(/\s+/g, " ");

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await navegador.newPage();
p.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));

await p.goto(`${BASE}/acceso`);
await p.getByLabel(/^Usuario, matricula o correo\*?$/).fill("admin");
await p.getByLabel(/^Contrasena\*?$/).fill("Demo1234");
await p.getByRole("button", { name: "Entrar" }).click();
await p.waitForURL("**/panel", { timeout: 20000 });

// ============ FALLA 1: desactivar conceptos ============
console.log("\n--- Falla 1: desactivar conceptos desde la pantalla ---");
const conceptosAntes = await db.conceptoCobro.findMany({ orderBy: { id: "asc" } });
comprobar("La demostracion trae conceptos activos",
  conceptosAntes.filter((c) => c.activo).length > 0,
  `${conceptosAntes.filter((c) => c.activo).length} activos`);

await p.goto(`${BASE}/panel/finanzas/conceptos`);
for (let intento = 0; intento < 20; intento++) {
  const boton = p.getByRole("button", { name: "desactivar" }).first();
  if ((await boton.count()) === 0) break;
  await boton.click();
  await p.waitForTimeout(1500);
}

const conceptosDespues = await db.conceptoCobro.findMany({ orderBy: { id: "asc" } });
comprobar("En la base quedan todos desactivados",
  conceptosDespues.every((c) => !c.activo),
  `${conceptosDespues.filter((c) => c.activo).length} siguen activos`);
comprobar("No se borro ningun concepto al desactivar",
  conceptosDespues.length === conceptosAntes.length,
  `${conceptosAntes.length} antes, ${conceptosDespues.length} despues`);

// Reactivar uno y comprobar que el interruptor va en los dos sentidos.
await p.getByRole("button", { name: "activar" }).first().click();
await p.waitForTimeout(1500);
const reactivados = await db.conceptoCobro.count({ where: { activo: true } });
comprobar("El interruptor tambien reactiva", reactivados === 1, `${reactivados} activos`);
await p.getByRole("button", { name: "desactivar" }).first().click();
await p.waitForTimeout(1500);

// ============ Preparar cargos ============
console.log("\n--- Preparacion: concepto propio y generacion de cargos ---");
await p.goto(`${BASE}/panel/finanzas/conceptos`);
await p.getByLabel(/^Clave\*?$/).fill("VER-1");
await p.getByLabel(/^Motivo del cobro\*?$/).fill("Colegiatura verificacion");
await p.getByLabel(/^Monto\*?$/).fill("1000");
await p.getByLabel(/^Periodicidad$/).selectOption("MENSUAL");
await p.getByLabel(/^Dia de vencimiento$/).fill("5");
await p.getByLabel(/^Fecha del primer cargo$/).fill("2026-08-05");
await p.getByLabel(/^Cuantos cargos$/).fill("3");
await p.getByRole("button", { name: "Crear concepto" }).click();
await p.waitForTimeout(2500);

const concepto = await db.conceptoCobro.findUnique({ where: { clave: "VER-1" } });
comprobar("El concepto se guardo con el tiempo configurado",
  concepto != null &&
    concepto.numeroCargos === 3 &&
    concepto.diaVencimiento === 5 &&
    concepto.fechaPrimerCargo?.toISOString().slice(0, 10) === "2026-08-05",
  concepto ? `${concepto.numeroCargos} cargos, dia ${concepto.diaVencimiento}, 1o ${concepto.fechaPrimerCargo?.toISOString().slice(0, 10)}` : "no existe");

await p.goto(`${BASE}/panel/finanzas`);
await p.getByRole("button", { name: "Generar cargos" }).click();
await p.waitForTimeout(6000);

const alumno = await db.alumno.findFirst({ where: { matricula: "2026-0001" } });
const cargosIniciales = await db.cargo.findMany({
  where: { alumnoId: alumno.id },
  orderBy: { fechaVencimiento: "asc" },
});
comprobar("Se generaron los 3 cargos del concepto", cargosIniciales.length === 3,
  `${cargosIniciales.length} cargos`);

const saldoInicial = cargosIniciales.reduce((s, c) => s + numero(c.saldo), 0);
comprobar("El saldo inicial es el esperado", saldoInicial === 3000, `${saldoInicial}`);

// ============ FALLA 2: cubrir el resto del saldo ============
console.log("\n--- Falla 2: pago parcial y luego cubrir el resto ---");
await p.goto(`${BASE}/panel/finanzas?q=2026-0001`);
await p.getByRole("link", { name: "Estado de cuenta" }).first().click();
await p.waitForURL(/\/panel\/finanzas\/alumno\/\d+/, { timeout: 15000 });
const urlCuenta = p.url();

await p.getByLabel(/^Monto recibido\*?$/).fill("200");
await p.getByRole("button", { name: "Registrar pago" }).click();
await p.waitForTimeout(3000);

const trasParcial = await db.cargo.findMany({
  where: { alumnoId: alumno.id },
  orderBy: { fechaVencimiento: "asc" },
});
const saldoTrasParcial = trasParcial.reduce((s, c) => s + numero(c.saldo), 0);
comprobar("El pago parcial baja el saldo exactamente 200", saldoTrasParcial === 2800, `${saldoTrasParcial}`);
comprobar("El cargo mas viejo queda PARCIAL", trasParcial[0].estado === "PARCIAL", trasParcial[0].estado);
comprobar("El resto de cargos no se toco",
  trasParcial.slice(1).every((c) => numero(c.saldo) === 1000));

await p.getByRole("button", { name: "Cubrir todo" }).click();
await p.waitForTimeout(700);
const montoCubrir = await p.getByLabel(/^Monto recibido\*?$/).inputValue();
comprobar("Cubrir todo propone exactamente el saldo restante", Number(montoCubrir) === 2800, montoCubrir);

await p.getByRole("button", { name: "Registrar pago" }).click();
await p.waitForTimeout(4000);

const trasTotal = await db.cargo.findMany({ where: { alumnoId: alumno.id } });
comprobar("Todos los cargos quedan en saldo 0",
  trasTotal.every((c) => numero(c.saldo) === 0),
  trasTotal.map((c) => numero(c.saldo)).join(", "));
comprobar("Todos los cargos quedan PAGADO",
  trasTotal.every((c) => c.estado === "PAGADO"),
  trasTotal.map((c) => c.estado).join(", "));

const alumnoTrasPago = await db.alumno.findUnique({ where: { id: alumno.id } });
comprobar("La bandera de adeudo se apaga", alumnoTrasPago.tieneAdeudo === false);

const pagos = await db.pago.findMany({
  where: { alumnoId: alumno.id },
  orderBy: { fecha: "asc" },
  include: { aplicaciones: true, recibo: true },
});
comprobar("Hay dos pagos registrados", pagos.length === 2, `${pagos.length}`);
const sumaAplicada = pagos.flatMap((p) => p.aplicaciones).reduce((s, a) => s + numero(a.monto), 0);
comprobar("Lo aplicado a cargos cuadra con lo cobrado", sumaAplicada === 3000, `${sumaAplicada}`);
comprobar("Cada pago tiene su recibo", pagos.every((p) => p.recibo != null));
comprobar("El recibo nace sin CFDI (comprobante interno)",
  pagos.every((p) => p.recibo.estadoCfdi === "NO_APLICA"));

// ============ FALLA 3: cancelar un pago ============
console.log("\n--- Falla 3: cancelar un pago y restaurar saldos ---");
const pagoACancelar = pagos[1];
await p.goto(urlCuenta);
await p.waitForTimeout(1500);
await p.getByRole("textbox", { name: "Motivo de la cancelacion" }).first().fill("Pago duplicado");
await p.getByRole("button", { name: "Cancelar pago" }).first().click();
await p.waitForTimeout(4000);

const pagoCancelado = await db.pago.findUnique({ where: { id: pagoACancelar.id } });
comprobar("El pago queda CANCELADO", pagoCancelado.estado === "CANCELADO", pagoCancelado.estado);
comprobar("Se guardo el motivo de la cancelacion",
  pagoCancelado.motivoCancelacion === "Pago duplicado", pagoCancelado.motivoCancelacion ?? "vacio");
comprobar("Se guardo quien y cuando cancelo",
  pagoCancelado.canceladoPor != null && pagoCancelado.canceladoEn != null);

const trasCancelar = await db.cargo.findMany({
  where: { alumnoId: alumno.id },
  orderBy: { fechaVencimiento: "asc" },
});
const saldoTrasCancelar = trasCancelar.reduce((s, c) => s + numero(c.saldo), 0);
comprobar("El saldo vuelve a ser el de antes del pago cancelado",
  saldoTrasCancelar === 2800, `${saldoTrasCancelar}`);
comprobar("Los estados de los cargos se restauran",
  trasCancelar[0].estado === "PARCIAL" &&
    trasCancelar.slice(1).every((c) => c.estado === "VENCIDO" || c.estado === "PENDIENTE"),
  trasCancelar.map((c) => c.estado).join(", "));

const alumnoTrasCancelar = await db.alumno.findUnique({ where: { id: alumno.id } });
comprobar("La bandera de adeudo se vuelve a encender", alumnoTrasCancelar.tieneAdeudo === true);

const aplicacionesVivas = await db.aplicacionPago.findMany({
  where: { pago: { estado: { not: "CANCELADO" } }, cargo: { alumnoId: alumno.id } },
});
const sumaViva = aplicacionesVivas.reduce((s, a) => s + numero(a.monto), 0);
comprobar("Solo cuenta lo aplicado por pagos vigentes", sumaViva === 200, `${sumaViva}`);

// El pago cancelado no debe poder cancelarse otra vez desde la pantalla.
await p.goto(urlCuenta);
await p.waitForTimeout(1200);
const cajasRestantes = await p.getByRole("textbox", { name: "Motivo de la cancelacion" }).count();
comprobar("El pago cancelado ya no ofrece cancelarse", cajasRestantes === 1, `${cajasRestantes} formularios`);
comprobar("La pantalla muestra el motivo guardado",
  (await limpio(p)).includes("Motivo: Pago duplicado"));

await navegador.close();
await db.$disconnect();
console.log(`\n${fallos.length === 0 ? "INTEGRIDAD DE FINANZAS VERIFICADA" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
