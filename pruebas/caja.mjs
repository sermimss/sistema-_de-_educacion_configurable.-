import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Caja por cajero y corte de caja: abrir con fondo, buscar alumno, cobrar e
// imprimir el recibo, cancelar dentro del turno, cerrar contando el
// efectivo, y que un corte cerrado no cambie. Requiere una base recien
// sembrada con los datos de demostracion y DATABASE_URL de esa base.

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const db = new PrismaClient();
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const texto = async (p) => (await p.locator("main").innerText()).replace(/\s+/g, " ");
const n = (v) => (v == null ? 0 : Number(v.toString()));

// ---------------- Datos ----------------
const col = await db.conceptoCobro.findUnique({ where: { clave: "COL" } });
const alumnoDe = (m) => db.alumno.findUnique({ where: { matricula: m } });
const a1 = await alumnoDe("2026-0001");
const a2 = await alumnoDe("2026-0002");
const a3 = await alumnoDe("2026-0003");
let k = 0;
const cargo = (alumno, monto, descripcion = "Colegiatura") =>
  db.cargo.create({
    data: {
      folio: `CJ-${++k}`, alumnoId: alumno.id, conceptoId: col.id, descripcion, montoOriginal: monto, montoTotal: monto, saldo: monto,
      fechaVencimiento: new Date(Date.now() + 10 * 86400000), estado: "PENDIENTE",
    },
  });
await cargo(a1, 1000);
await cargo(a2, 800);
await cargo(a3, 600);
await db.usuario.create({ data: { usuario: "cajera2", passwordHash: await bcrypt.hash("Caja2026!", 10), rol: "ADMIN" } });

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function entrar(usuario, clave = "Demo1234") {
  const p = await (await navegador.newContext()).newPage();
  p.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));
  p.on("dialog", (d) => d.accept());
  await p.goto(`${BASE}/acceso`);
  await p.getByLabel(/^Usuario, matricula o correo\*?$/).fill(usuario);
  await p.getByLabel(/^Contrasena\*?$/).fill(clave);
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.waitForURL("**/panel", { timeout: 20000 });
  return p;
}
const admin = await entrar("admin");
const usuarioAdmin = await db.usuario.findUnique({ where: { usuario: "admin" } });

// ---------------- Sin caja no se cobra ----------------
comprobar("Caja esta en el menu de la administracion", (await admin.locator("aside").innerText()).includes("Caja"));
await admin.goto(`${BASE}/panel/finanzas/alumno/${a1.id}`);
comprobar("Sin caja abierta el estado de cuenta pide abrirla en lugar de cobrar",
  (await texto(admin)).includes("Para cobrar abre tu caja") && (await admin.locator("[data-formulario-pago]").count()) === 0);
await admin.goto(`${BASE}/panel/caja`);
comprobar("La caja aparece cerrada", (await texto(admin)).includes("Tu caja esta cerrada"));

// ---------------- Abrir ----------------
await admin.locator("[data-abrir-caja]").getByLabel(/^Fondo inicial/).fill("500");
await admin.getByRole("button", { name: "Abrir caja" }).click();
await admin.locator("[data-resumen-turno]").waitFor({ timeout: 15000 });
const turno = await db.turnoCaja.findFirst({ where: { usuarioId: usuarioAdmin.id, estado: "ABIERTO" } });
comprobar("Abre la caja con su fondo inicial", n(turno?.fondoInicial) === 500);

// ---------------- Buscar y cobrar con impresion ----------------
async function cobrarEnCaja(p, busqueda, { monto, metodo = "EFECTIVO", referencia = "" }) {
  await p.goto(`${BASE}/panel/caja`);
  await p.getByLabel("Buscar alumno").fill(busqueda);
  await p.getByRole("button", { name: "Buscar" }).click();
  await p.locator("[data-resultados-caja] a").first().click();
  await p.locator("[data-formulario-pago]").waitFor({ timeout: 15000 });
  const f = p.locator("[data-formulario-pago]");
  await f.getByLabel(/^Monto recibido/).fill(String(monto));
  await f.getByLabel(/^Metodo de pago/).selectOption(metodo);
  if (referencia) await f.getByLabel(/^Referencia/).fill(referencia);
  await f.getByRole("button", { name: "Registrar pago" }).click();
  await p.waitForURL(/\/panel\/finanzas\/recibo\/\d+\?imprimir=1/, { timeout: 20000 });
}
await cobrarEnCaja(admin, "Ramirez", { monto: 1200 });
comprobar("Al cobrar se abre el recibo listo para imprimir", /recibo de pago/i.test(await texto(admin)) && (await admin.locator("[data-recibo-cambio]").innerText()).includes("$200.00"));
await admin.locator("[data-volver-caja]").click();
await admin.waitForURL(/\/panel\/caja$/, { timeout: 15000 });
comprobar("Y regresa a la caja para el siguiente alumno", admin.url().endsWith("/panel/caja"));
const pago1 = await db.pago.findFirst({ where: { alumnoId: a1.id } });
comprobar("El cobro queda en el turno de quien cobro", pago1.turnoId === turno.id && n(pago1.montoTotal) === 1000);

await cobrarEnCaja(admin, "2026-0002", { monto: 800, metodo: "TRANSFERENCIA", referencia: "SPEI-CAJA-1" });
await cobrarEnCaja(admin, "Nunez", { monto: 600 });
await admin.goto(`${BASE}/panel/caja`);
const resumen = await admin.locator("[data-resumen-turno]").innerText();
comprobar("El turno muestra lo cobrado y el efectivo que debe haber", resumen.includes("$2,400.00 (3)") && resumen.includes("$2,100.00"), resumen.replace(/\s+/g, " "));
comprobar("Lista los cobros del turno", (await admin.locator("[data-cobro-turno]").count()) === 3);

// ---------------- Cancelar dentro del turno ----------------
const pago3 = await db.pago.findFirst({ where: { alumnoId: a3.id } });
await admin.goto(`${BASE}/panel/finanzas/alumno/${a3.id}`);
await admin.getByRole("textbox", { name: "Motivo de la cancelacion" }).first().fill("Se cobro al alumno equivocado");
await admin.getByRole("button", { name: "Cancelar pago" }).first().click();
await admin.getByText(/cancelado y saldos restaurados/).first().waitFor({ timeout: 15000 }).catch(() => {});
comprobar("Con la caja abierta se puede cancelar un cobro", (await db.pago.findUnique({ where: { id: pago3.id } })).estado === "CANCELADO");
await admin.goto(`${BASE}/panel/caja`);
const resumen2 = await admin.locator("[data-resumen-turno]").innerText();
comprobar("Lo cancelado deja de contar en el turno", resumen2.includes("$1,800.00 (2)") && resumen2.includes("$1,500.00"), resumen2.replace(/\s+/g, " "));

// ---------------- Corte parcial y cierre ----------------
await admin.goto(`${BASE}/panel/caja/corte/${turno.id}`);
const parcial = await texto(admin);
comprobar("El corte parcial muestra los totales por metodo", /corte parcial/i.test(parcial) && parcial.includes("Efectivo") && parcial.includes("Transferencia") && parcial.includes("Cancelados"));
await admin.goto(`${BASE}/panel/caja`);
const cierre = admin.locator("[data-cerrar-caja]");
await cierre.getByLabel(/^Efectivo contado/).fill("1450");
comprobar("Antes de cerrar avisa si falta efectivo", (await cierre.locator("[data-diferencia]").innerText()).includes("Faltan $50.00"));
await cierre.getByLabel("Notas (opcional)").fill("Faltante por revisar");
await cierre.getByRole("button", { name: "Cerrar caja y hacer el corte" }).click();
await admin.waitForURL(/\/panel\/caja\/corte\/\d+\?cerrado=1/, { timeout: 20000 });
const turnoCerrado = await db.turnoCaja.findUnique({ where: { id: turno.id } });
comprobar("Cierra el corte con lo esperado, lo contado y la diferencia",
  turnoCerrado.estado === "CERRADO" && n(turnoCerrado.efectivoEsperado) === 1500 && n(turnoCerrado.efectivoContado) === 1450 && n(turnoCerrado.diferencia) === -50);
comprobar("El corte impreso indica el faltante", (await admin.locator("[data-diferencia-corte]").innerText()).includes("Faltan $50.00") && (await texto(admin)).includes("Faltante por revisar"));
comprobar("El corte trae el detalle de cada cobro", (await admin.locator("[data-pago-corte]").count()) === 3);

// ---------------- Corte cerrado: no cambia ----------------
await admin.goto(`${BASE}/panel/finanzas/alumno/${a1.id}`);
comprobar("Un pago de un corte cerrado ya no ofrece cancelarse",
  (await admin.locator("[data-corte-cerrado]").count()) === 1 && (await admin.getByRole("button", { name: "Cancelar pago" }).count()) === 0);
comprobar("Y sin caja abierta ya no se puede cobrar", (await texto(admin)).includes("Para cobrar abre tu caja"));
await admin.goto(`${BASE}/panel/caja`);
comprobar("La caja queda cerrada y muestra el ultimo corte", (await texto(admin)).includes("Tu caja esta cerrada") && (await texto(admin)).includes(`Corte #${turno.id}`));

// El servidor tambien lo exige: un formulario abierto antes de cerrar la caja.
await admin.getByRole("button", { name: "Abrir caja" }).click();
await admin.locator("[data-resumen-turno]").waitFor({ timeout: 15000 });
await admin.goto(`${BASE}/panel/finanzas/alumno/${a3.id}`);
await db.turnoCaja.updateMany({ where: { usuarioId: usuarioAdmin.id, estado: "ABIERTO" }, data: { estado: "CERRADO", cerradoEn: new Date() } });
await admin.locator("[data-formulario-pago]").getByLabel(/^Monto recibido/).fill("100");
await admin.locator("[data-formulario-pago]").getByRole("button", { name: "Registrar pago" }).click();
await admin.getByText(/Abre tu caja/).first().waitFor({ timeout: 15000 }).catch(() => {});
comprobar("Sin caja abierta el servidor rechaza el cobro", (await texto(admin)).includes("Abre tu caja") && (await db.pago.count({ where: { alumnoId: a3.id, estado: { not: "CANCELADO" } } })) === 0);

// ---------------- Por cajero ----------------
const cajera = await entrar("cajera2", "Caja2026!");
await cajera.goto(`${BASE}/panel/caja`);
comprobar("Cada cajero tiene su propia caja", (await texto(cajera)).includes("Tu caja esta cerrada"));
await cajera.getByRole("button", { name: "Abrir caja" }).click();
await cajera.locator("[data-resumen-turno]").waitFor({ timeout: 15000 });
await cobrarEnCaja(cajera, "Nunez", { monto: 600 });
const usuarioCajera = await db.usuario.findUnique({ where: { usuario: "cajera2" } });
const turnoCajera = await db.turnoCaja.findFirst({ where: { usuarioId: usuarioCajera.id, estado: "ABIERTO" }, include: { pagos: true } });
comprobar("Sus cobros van a su turno, no al de otro", turnoCajera.pagos.length === 1 && turnoCajera.id !== turno.id);
await admin.goto(`${BASE}/panel/caja/cortes`);
const lista = await texto(admin);
comprobar("La lista de cortes muestra los de todos los cajeros", (await admin.locator("[data-corte-lista]").count()) >= 3 && lista.includes("cajera2") && lista.includes("abierta"));
await admin.getByLabel("Cajero").selectOption(String(usuarioCajera.id));
await admin.getByRole("button", { name: "Filtrar" }).click();
await admin.waitForURL(/cajero=/);
comprobar("Se puede filtrar por cajero", (await admin.locator("[data-corte-lista]").count()) === 1);
comprobar("Queda en la bitacora", (await db.bitacora.count({ where: { entidad: "TurnoCaja" } })) >= 3);

await navegador.close();
await db.$disconnect();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DE CAJA PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
