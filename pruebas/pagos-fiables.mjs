import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

// Captura de pagos confiable: recargos al dia, saldo a favor, cambio en
// efectivo, fecha de recepcion, referencia obligatoria y repetida, doble
// envio, dos cajas al mismo tiempo y adeudo por fecha. Requiere una base
// recien sembrada con los datos de demostracion y DATABASE_URL de esa base.

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const db = new PrismaClient();
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const texto = async (p) => (await p.locator("main").innerText()).replace(/\s+/g, " ");
const n = (v) => (v == null ? 0 : Number(v.toString()));
const DIA = 86400000;
const dia = (ms) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) + ms);
const textoDia = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date(Date.now() + ms));

// ---------------- Datos de prueba ----------------
const col = await db.conceptoCobro.findUnique({ where: { clave: "COL" } });
let consecutivo = 0;
async function cargo(matricula, descripcion, monto, venceEnDias) {
  const alumno = await db.alumno.findUnique({ where: { matricula } });
  return db.cargo.create({
    data: {
      folio: `T-${++consecutivo}`, alumnoId: alumno.id, conceptoId: col.id, descripcion,
      montoOriginal: monto, montoTotal: monto, saldo: monto, fechaVencimiento: dia(venceEnDias * DIA), estado: "PENDIENTE",
    },
  });
}
const alumnoDe = (m) => db.alumno.findUnique({ where: { matricula: m } });
const a1 = await alumnoDe("2026-0001");
const a2 = await alumnoDe("2026-0002");
const a3 = await alumnoDe("2026-0003");
const a4 = await alumnoDe("2026-0004");
const sept = await cargo("2026-0001", "Colegiatura septiembre", 1000, -20);
const oct = await cargo("2026-0001", "Colegiatura octubre", 1000, 10);

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
const admin = await entrar("admin");
const cuenta = (alumno) => admin.goto(`${BASE}/panel/finanzas/alumno/${alumno.id}`);
const form = (p) => p.locator("[data-formulario-pago]");
async function cobrar(p, { monto, metodo = "EFECTIVO", referencia = "", fecha = null, espera = /registrado por|Ya hay un pago|Escribe la referencia|futura|no tiene cargos|ya estaba registrado/ }) {
  const f = form(p);
  await f.getByLabel(/^Monto recibido/).fill(String(monto));
  await f.getByLabel(/^Metodo de pago/).selectOption(metodo);
  await f.getByLabel(/^(Referencia|Numero de cheque)/).fill(referencia);
  if (fecha) {
    await f.getByLabel(/^Fecha en que se recibio/).evaluate((el) => el.removeAttribute("max"));
    await f.getByLabel(/^Fecha en que se recibio/).fill(fecha);
  }
  await f.getByRole("button", { name: "Registrar pago" }).click();
  await p.getByText(espera).first().waitFor({ timeout: 20000 }).catch(() => {});
  return texto(p);
}

// ---------------- 1. Recargos al dia ----------------
await cuenta(a1);
const sept1 = await db.cargo.findUnique({ where: { id: sept.id } });
comprobar("Al abrir el estado de cuenta, el cargo vencido ya trae su recargo", n(sept1.montoRecargo) === 100 && n(sept1.saldo) === 1100, `${sept1.montoRecargo} ${sept1.saldo}`);
comprobar("Y queda marcado como vencido", sept1.estado === "VENCIDO");
comprobar("El cargo que aun no vence no lleva recargo", n((await db.cargo.findUnique({ where: { id: oct.id } })).montoRecargo) === 0);

// Pago a tiempo capturado despues: sin recargo.
const tardio = await cargo("2026-0003", "Colegiatura agosto", 1000, -10);
await cuenta(a3);
comprobar("Antes de capturar el pago, ese cargo ya tiene recargo", n((await db.cargo.findUnique({ where: { id: tardio.id } })).montoRecargo) === 100);
let r = await cobrar(admin, { monto: 1000, metodo: "TRANSFERENCIA", referencia: "SPEI-AGO-1", fecha: textoDia(-12 * DIA) });
const tardioPagado = await db.cargo.findUnique({ where: { id: tardio.id } });
comprobar("Si el dinero llego antes del vencimiento, se quita el recargo y queda pagado",
  tardioPagado.estado === "PAGADO" && n(tardioPagado.montoRecargo) === 0, r.slice(0, 160));
const pagoAtrasado = await db.pago.findFirst({ where: { referencia: "SPEI-AGO-1" } });
comprobar("El pago guarda la fecha en que se recibio", pagoAtrasado.fecha.toISOString().slice(0, 10) === textoDia(-12 * DIA), pagoAtrasado.fecha.toISOString());

// ---------------- 7. Referencia obligatoria ----------------
await cuenta(a1);
await form(admin).getByLabel(/^Metodo de pago/).selectOption("TRANSFERENCIA");
comprobar("Con transferencia la referencia es obligatoria en el formulario", await form(admin).getByLabel(/^Referencia/).evaluate((el) => el.required));
await form(admin).getByLabel(/^Metodo de pago/).selectOption("EFECTIVO");
comprobar("En efectivo no", !(await form(admin).getByLabel(/^Referencia/).evaluate((el) => el.required)));
await form(admin).getByLabel(/^Metodo de pago/).selectOption("TRANSFERENCIA");
await form(admin).getByLabel(/^Referencia/).evaluate((el) => el.removeAttribute("required"));
await form(admin).getByLabel(/^Monto recibido/).fill("100");
await form(admin).getByRole("button", { name: "Registrar pago" }).click();
await admin.getByText(/Escribe la referencia/).first().waitFor({ timeout: 15000 }).catch(() => {});
comprobar("Y el servidor tambien la exige", (await texto(admin)).includes("Escribe la referencia"));

// ---------------- 2. Saldo a favor ----------------
await cuenta(a1);
await form(admin).getByLabel(/^Metodo de pago/).selectOption("TRANSFERENCIA");
await form(admin).getByLabel(/^Monto recibido/).fill("2500");
comprobar("Antes de registrar avisa que sobrara saldo a favor", (await form(admin).locator("[data-aviso-sobrante]").innerText()).includes("saldo a favor"));
r = await cobrar(admin, { monto: 2500, metodo: "TRANSFERENCIA", referencia: "TRF-001" });
comprobar("Una transferencia mayor a la deuda deja saldo a favor", r.includes("Quedan $400.00 como saldo a favor"), r.slice(0, 200));
const pagoA = await db.pago.findFirst({ where: { referencia: "TRF-001" }, include: { aplicaciones: true, recibo: true } });
comprobar("Se registra el monto completo recibido", n(pagoA.montoTotal) === 2500 && pagoA.aplicaciones.reduce((s, a) => s + n(a.monto), 0) === 2100);
await cuenta(a1);
comprobar("El estado de cuenta muestra el saldo a favor", /a favor \$400\.00/i.test(await texto(admin)));
await admin.getByLabel(/^Motivo del cargo/).fill("Reposicion de credencial");
await admin.getByLabel(/^Monto\*?$/).last().fill("300");
await admin.getByLabel(/^Vence el/).fill(textoDia(15 * DIA));
await admin.getByRole("button", { name: "Agregar cargo" }).click();
await admin.getByText(/Se cubrieron 300 con su saldo a favor/).waitFor({ timeout: 15000 }).catch(() => {});
const credencial = await db.cargo.findFirst({ where: { descripcion: "Reposicion de credencial" } });
comprobar("Un cargo nuevo se cubre solo con el saldo a favor", credencial.estado === "PAGADO" && (await texto(admin)).includes("Se cubrieron 300"));
await admin.goto(`${BASE}/panel/finanzas/recibo/${pagoA.id}`);
const recibo = await texto(admin);
comprobar("El recibo no cambia: muestra lo aplicado al emitirlo y el saldo a favor de ese momento",
  recibo.includes("Colegiatura septiembre") && !recibo.includes("Reposicion de credencial") && (await admin.locator("[data-recibo-a-favor]").innerText()).includes("$400.00"));
const alumno1 = await entrar("2026-0001");
await alumno1.goto(`${BASE}/panel/estado-de-cuenta`);
comprobar("El alumno ve su saldo a favor en su portal", /a favor \$100\.00/i.test(await texto(alumno1)));

// ---------------- 2b. Cambio en efectivo ----------------
await cargo("2026-0002", "Colegiatura noviembre", 1000, 5);
await cuenta(a2);
await form(admin).getByLabel(/^Monto recibido/).fill("1200");
comprobar("En efectivo avisa el cambio antes de registrar", (await form(admin).locator("[data-aviso-sobrante]").innerText()).includes("entregalo como cambio"));
r = await cobrar(admin, { monto: 1200 });
const pagoEfectivo = await db.pago.findFirst({ where: { alumnoId: a2.id }, orderBy: { id: "desc" } });
comprobar("En efectivo el sobrante es cambio, no saldo a favor",
  r.includes("Entrega de cambio: $200.00") && n(pagoEfectivo.montoTotal) === 1000 && n(pagoEfectivo.efectivoRecibido) === 1200);
await admin.goto(`${BASE}/panel/finanzas/recibo/${pagoEfectivo.id}`);
comprobar("El recibo indica efectivo recibido y cambio", (await admin.locator("[data-recibo-cambio]").innerText()).includes("cambio entregado $200.00"));

// ---------------- 3. Fecha ----------------
await cargo("2026-0002", "Colegiatura diciembre", 1000, 35);
await cuenta(a2);
r = await cobrar(admin, { monto: 50, fecha: textoDia(2 * DIA), espera: /futura/ });
comprobar("No acepta fechas futuras", r.includes("no puede ser futura"));
await cuenta(a2);
r = await cobrar(admin, { monto: 50, fecha: "2025-01-15" });
comprobar("Acepta cualquier fecha pasada", (await db.pago.count({ where: { alumnoId: a2.id, fecha: { lt: new Date("2025-02-01") } } })) === 1, r.slice(0, 120));

// ---------------- 4. Referencia repetida y doble envio ----------------
await cuenta(a2);
r = await cobrar(admin, { monto: 100, metodo: "TRANSFERENCIA", referencia: "trf-001", espera: /Ya hay un pago/ });
comprobar("Avisa de una referencia ya usada, con el pago anterior", r.includes("Ya hay un pago con esa misma referencia") && (await admin.locator("[data-aviso-duplicado]").innerText()).includes(pagoA.folio));
comprobar("Sin confirmar no registra nada", (await db.pago.count({ where: { alumnoId: a2.id, referencia: { equals: "trf-001", mode: "insensitive" } } })) === 0);
await admin.getByRole("button", { name: "Es otro pago distinto: registrarlo" }).click();
await admin.getByText(/registrado por/).first().waitFor({ timeout: 15000 }).catch(() => {});
comprobar("Al confirmar si lo registra", (await db.pago.count({ where: { alumnoId: a2.id, referencia: "trf-001" } })) === 1);

await cuenta(a2);
const antes = await db.pago.count();
await form(admin).getByLabel(/^Monto recibido/).fill("10");
await form(admin).evaluate((f) => { f.requestSubmit(); f.requestSubmit(); f.requestSubmit(); });
await admin.waitForTimeout(4000);
comprobar("El mismo formulario enviado tres veces registra un solo pago", (await db.pago.count()) === antes + 1, `${(await db.pago.count()) - antes}`);

// ---------------- 5. Dos cajas al mismo tiempo ----------------
await cargo("2026-0004", "Colegiatura unica", 1000, 3);
const caja1 = await entrar("admin");
const caja2 = await entrar("admin");
await caja1.goto(`${BASE}/panel/finanzas/alumno/${a4.id}`);
await caja2.goto(`${BASE}/panel/finanzas/alumno/${a4.id}`);
for (const c of [caja1, caja2]) await form(c).getByLabel(/^Monto recibido/).fill("1000");
await Promise.all([caja1, caja2].map((c) => form(c).getByRole("button", { name: "Registrar pago" }).click()));
await caja1.waitForTimeout(5000);
const pagos4 = await db.pago.findMany({ where: { alumnoId: a4.id, estado: { not: "CANCELADO" } } });
const cargo4 = await db.cargo.findFirst({ where: { alumnoId: a4.id, descripcion: "Colegiatura unica" } });
comprobar("Dos cajas cobrando el mismo cargo a la vez: solo uno se cobra", pagos4.length === 1 && n(cargo4.saldo) === 0, `${pagos4.length} pagos`);
const mensajes = (await texto(caja1)) + (await texto(caja2));
comprobar("La otra caja recibe un aviso claro", mensajes.includes("no tiene cargos pendientes"));
await cargo("2026-0001", "Taller A", 500, 20);
await cargo("2026-0002", "Taller B", 500, 20);
await caja1.goto(`${BASE}/panel/finanzas/alumno/${a1.id}`);
await caja2.goto(`${BASE}/panel/finanzas/alumno/${a2.id}`);
for (const c of [caja1, caja2]) await form(c).getByLabel(/^Monto recibido/).fill("100");
const total = await db.pago.count();
await Promise.all([caja1, caja2].map((c) => form(c).getByRole("button", { name: "Registrar pago" }).click()));
await caja1.waitForTimeout(5000);
const folios = (await db.pago.findMany({ orderBy: { id: "desc" }, take: 2 })).map((p) => p.folio);
comprobar("Dos cobros simultaneos a alumnos distintos: los dos se registran con folios distintos",
  (await db.pago.count()) === total + 2 && new Set(folios).size === 2, folios.join(" "));
const recibos = await db.recibo.findMany({ select: { serie: true, folio: true } });
comprobar("Ningun folio de recibo repetido", new Set(recibos.map((x) => `${x.serie}-${x.folio}`)).size === recibos.length);

// ---------------- 6. Adeudo por fecha ----------------
const marisol = await db.alumno.findUnique({ where: { matricula: "2026-0004" } });
await db.cargo.create({
  data: { folio: "T-VENCE", alumnoId: marisol.id, descripcion: "Material vencido", montoOriginal: 200, montoTotal: 200, saldo: 200, fechaVencimiento: dia(-2 * DIA), estado: "PENDIENTE" },
});
await db.alumno.update({ where: { id: marisol.id }, data: { tieneAdeudo: false } });
await db.configuracion.update({ where: { clave: "portales.docente_ve_adeudos" }, data: { valor: "true" } });
const docente = await entrar("docente");
const mat = (await db.clase.findMany({ include: { planMateria: { include: { materia: true } } } })).find((c) => c.planMateria.materia.nombre === "Matematicas I");
await docente.goto(`${BASE}/panel/asistencia?clase=${mat.id}`);
const marcas = await docente.locator("[data-marca-adeudo]").count();
comprobar("El docente ve el adeudo de un cargo que vencio aunque nadie haya cobrado nada", marcas >= 1, `${marcas}`);
await admin.goto(`${BASE}/panel/finanzas`);
comprobar("La lista de adeudos de Finanzas lo incluye", (await texto(admin)).includes(marisol.matricula));

// ---------------- Cancelar un pago con saldo a favor ----------------
await cuenta(a1);
await admin.locator("li", { hasText: pagoA.folio }).getByRole("textbox", { name: "Motivo de la cancelacion" }).fill("Transferencia rechazada por el banco");
await admin.locator("li", { hasText: pagoA.folio }).getByRole("button", { name: "Cancelar pago" }).click();
await admin.getByText(/cancelado y saldos restaurados/).first().waitFor({ timeout: 15000 }).catch(() => {});
const trasCancelar = await db.cargo.findMany({ where: { id: { in: [sept.id, oct.id, credencial.id] } } });
comprobar("Al cancelar, los cargos que cubria (incluido el pagado con su saldo a favor) vuelven a quedar pendientes",
  trasCancelar.every((c) => n(c.saldo) > 0), trasCancelar.map((c) => `${c.descripcion}:${c.saldo}`).join(" "));
await alumno1.goto(`${BASE}/panel/estado-de-cuenta`);
const portal = await texto(alumno1);
comprobar("En el portal el cargo atrasado se ve vencido y ya sin saldo a favor", portal.includes("vencido") && !/a favor \$/i.test(portal));
comprobar("Todo queda en la bitacora", (await db.bitacora.count({ where: { entidad: "Pago" } })) >= 8);

await navegador.close();
await db.$disconnect();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DE PAGOS FIABLES PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
