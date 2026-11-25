import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Cobranza: referencia de pago por alumno y datos bancarios, comprobantes
// que sube el alumno (verificar, confirmar en caja o rechazar con motivo),
// el acceso de Caja (cajero) dado desde Personal y generar cargos por
// matricula. Requiere una base recien sembrada con los datos de
// demostracion y DATABASE_URL de esa base.

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const db = new PrismaClient();
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const texto = async (p) => (await p.locator("main").innerText()).replace(/\s+/g, " ");
const n = (v) => (v == null ? 0 : Number(v.toString()));

// Referencia esperada: id a 8 digitos + digito verificador (Luhn).
function referenciaEsperada(id) {
  const base = String(id).padStart(8, "0");
  let suma = 0;
  [...base].reverse().forEach((c, i) => {
    let d = Number(c);
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    suma += d;
  });
  return base + ((10 - (suma % 10)) % 10);
}

// ---------------- Datos ----------------
const col = await db.conceptoCobro.findUnique({ where: { clave: "COL" } });
const alumnoDe = (m) => db.alumno.findUnique({ where: { matricula: m } });
const a1 = await alumnoDe("2026-0001");
const a2 = await alumnoDe("2026-0002");
const a3 = await alumnoDe("2026-0003");
let k = 0;
const cargo = (alumno, monto) =>
  db.cargo.create({
    data: {
      folio: `CB-${++k}`, alumnoId: alumno.id, conceptoId: col.id, descripcion: "Colegiatura", montoOriginal: monto, montoTotal: monto, saldo: monto,
      fechaVencimiento: new Date(Date.now() + 10 * 86400000), estado: "PENDIENTE",
    },
  });
const cargoA1 = await cargo(a1, 1000);
await cargo(a2, 800);

// PNG de 1x1 real y un "PDF" que en realidad es texto.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const pdfFalso = Buffer.from("esto no es un pdf");

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

// ---------------- Datos bancarios y referencia ----------------
await admin.goto(`${BASE}/panel/configuracion`); // crea las claves nuevas
for (const [clave, valor] of [
  ["finanzas.pago_banco", "Banco Demo"],
  ["finanzas.pago_titular", "Colegio Demo AC"],
  ["finanzas.pago_clabe", "012345678901234567"],
]) {
  await db.configuracion.update({ where: { clave }, data: { valor } });
}
comprobar("Configuracion tiene los datos para pagar por transferencia",
  (await db.configuracion.count({ where: { clave: { in: ["finanzas.pago_banco", "finanzas.pago_titular", "finanzas.pago_cuenta", "finanzas.pago_clabe", "finanzas.pago_instrucciones"] } } })) === 5);

const alumno = await entrar("2026-0001");
await alumno.goto(`${BASE}/panel/estado-de-cuenta`);
const comoPagar = (await alumno.locator("[data-como-pagar]").innerText()).replace(/\s+/g, " ");
comprobar("El alumno ve su referencia de pago con digito verificador",
  (await alumno.locator("[data-referencia-alumno]").innerText()).trim() === referenciaEsperada(a1.id), comoPagar);
comprobar("Y los datos bancarios e instrucciones del colegio",
  comoPagar.includes("Banco Demo") && comoPagar.includes("012345678901234567") && comoPagar.includes("referencia"));

// ---------------- El alumno sube comprobantes ----------------
async function subirComprobante({ monto, referencia, archivo, nombre = "comprobante.png", mime = "image/png" }) {
  const f = alumno.locator("[data-subir-comprobante]");
  await f.getByLabel(/^Monto que pagaste/).fill(String(monto));
  await f.getByLabel(/^Numero de operacion o clave de rastreo/).fill(referencia);
  await f.locator("#archivo-comprobante").setInputFiles({ name: nombre, mimeType: mime, buffer: archivo });
  await f.getByRole("button", { name: "Enviar comprobante" }).click();
  await alumno.locator("[data-subir-comprobante] [role=alert], [data-subir-comprobante] .alerta, [data-subir-comprobante] div").first().waitFor({ timeout: 5000 }).catch(() => {});
  await alumno.waitForTimeout(2500);
}
await subirComprobante({ monto: 1000, referencia: "SPEI-ALU-1", archivo: pdfFalso, nombre: "comprobante.pdf", mime: "application/pdf" });
const tras = await texto(alumno);
comprobar("Rechaza un archivo que no es lo que dice ser", tras.includes("no es realmente un archivo") && (await db.comprobantePago.count()) === 0);
comprobar("Con el error conserva lo capturado",
  (await alumno.locator("[data-subir-comprobante]").getByLabel(/^Numero de operacion/).inputValue()) === "SPEI-ALU-1");

await subirComprobante({ monto: 1000, referencia: "SPEI-ALU-1", archivo: png });
comprobar("Envia el comprobante y queda por verificar",
  (await texto(alumno)).includes("Comprobante enviado") && (await db.comprobantePago.count({ where: { alumnoId: a1.id, estado: "POR_VERIFICAR" } })) === 1);
await alumno.goto(`${BASE}/panel/estado-de-cuenta`);
comprobar("El alumno lo ve como Por verificar", (await alumno.locator('[data-mi-comprobante="POR_VERIFICAR"]').count()) === 1);

await subirComprobante({ monto: 1000, referencia: "SPEI-ALU-1", archivo: png });
comprobar("No acepta dos comprobantes con la misma referencia",
  (await texto(alumno)).includes("misma referencia") && (await db.comprobantePago.count()) === 1);

await alumno.goto(`${BASE}/panel/estado-de-cuenta`);
await subirComprobante({ monto: 500, referencia: "DEP-ALU-2", archivo: png });
const comp1 = await db.comprobantePago.findFirst({ where: { referencia: "SPEI-ALU-1" } });
const comp2 = await db.comprobantePago.findFirst({ where: { referencia: "DEP-ALU-2" } });
comprobar("Guarda el archivo en la base", Boolean(comp2) && comp1.archivoMime === "image/png" && comp1.archivoTamano === png.length);

// ---------------- Alta de cajero desde Personal ----------------
const sello = Date.now().toString().slice(-5);
await admin.goto(`${BASE}/panel/personal/nuevo`);
await admin.getByLabel(/^Nombre\(s\)\*?$/).fill("Rosa");
await admin.getByLabel(/^Apellido paterno\*?$/).fill(`Cajera${sello}`);
await admin.getByLabel(/^Correo\*?$/).fill(`rosa${sello}@demo.mx`);
await admin.getByLabel(/^Puesto\*?$/).fill("Cajera");
await admin.getByRole("checkbox", { name: /Imparte clases/ }).uncheck();
comprobar("Al quitar 'Imparte clases' el acceso pasa a Administracion", (await admin.getByLabel(/^Acceso al sistema/).inputValue()) === "ADMIN");
await admin.getByLabel(/^Acceso al sistema/).selectOption("CAJERO");
await admin.getByRole("button", { name: "Dar de alta" }).click();
await admin.waitForURL(/\/panel\/personal\/\d+/, { timeout: 20000 });
const empleadoCajera = await db.empleado.findFirst({ where: { apellidoPaterno: `Cajera${sello}` }, include: { usuario: true } });
comprobar("Personal da de alta a la cajera con acceso de Caja", empleadoCajera?.usuario?.rol === "CAJERO");
comprobar("Su ficha muestra el acceso", (await admin.locator("[data-acceso-empleado]").innerText()).includes("Caja"));
await db.usuario.update({ where: { id: empleadoCajera.usuarioId }, data: { passwordHash: await bcrypt.hash("Caja2026!", 10), debeCambiarPassword: false } });
const usuarioCajera = empleadoCajera.usuario.usuario;

// ---------------- Lo que ve y no ve la cajera ----------------
const cajera = await entrar(usuarioCajera, "Caja2026!");
const menu = (await cajera.locator("aside a").allInnerTexts()).map((t) => t.trim());
comprobar("Su menu tiene Caja y Comprobantes, y no Finanzas ni Alumnos",
  menu.includes("Caja") && menu.includes("Comprobantes de pago") && !menu.includes("Finanzas") && !menu.includes("Alumnos") && !menu.some((t) => t.startsWith("Personal")), menu.join(" | "));
const panelCajera = await texto(cajera);
comprobar("Su panel avisa de los comprobantes por verificar", panelCajera.includes("2 comprobante(s) de pago por verificar") && panelCajera.includes("Tu caja esta cerrada"));
for (const ruta of ["/panel/finanzas", "/panel/alumnos", "/panel/calificaciones", "/panel/asistencia", "/panel/personal", "/panel/configuracion"]) {
  await cajera.goto(`${BASE}${ruta}`);
  if (!cajera.url().includes("sin-permiso")) comprobar(`No entra a ${ruta}`, false, cajera.url());
}
comprobar("No entra a finanzas, alumnos, calificaciones, asistencia, personal ni configuracion", true);

// ---------------- Verificar sin caja, abrir caja, confirmar ----------------
await cajera.goto(`${BASE}/panel/caja/comprobantes`);
comprobar("La bandeja lista los dos comprobantes", (await cajera.locator("[data-comprobante-pendiente]").count()) === 2);
comprobar("Avisa que necesita su caja abierta para confirmar", (await texto(cajera)).toLowerCase().includes("caja"));
const verArchivo = await cajera.request.get(`${BASE}/panel/caja/comprobantes/archivo/${comp1.id}`);
comprobar("Puede ver el archivo del comprobante", verArchivo.ok() && (await verArchivo.body()).equals(png));
const ajeno = await entrar("2026-0002");
const verAjeno = await ajeno.request.get(`${BASE}/panel/caja/comprobantes/archivo/${comp1.id}`);
comprobar("Otro alumno no puede ver ese archivo", !verAjeno.ok() || !(await verAjeno.body()).equals(png));

const formaConfirmar = (id) => cajera.locator(`[data-confirmar-comprobante="${id}"]`);
await formaConfirmar(comp1.id).getByRole("button", { name: "Confirmar y registrar el pago" }).click();
await cajera.waitForTimeout(2500);
comprobar("Sin caja abierta no confirma", (await formaConfirmar(comp1.id).innerText()).includes("Abrir mi caja") && (await db.pago.count({ where: { alumnoId: a1.id } })) === 0);

await cajera.goto(`${BASE}/panel/caja`);
await cajera.locator("[data-abrir-caja]").getByLabel(/^Fondo inicial/).fill("300");
await cajera.getByRole("button", { name: "Abrir caja" }).click();
await cajera.locator("[data-resumen-turno]").waitFor({ timeout: 15000 });
const turnoCajera = await db.turnoCaja.findFirst({ where: { usuarioId: empleadoCajera.usuarioId, estado: "ABIERTO" } });
comprobar("La cajera abre su propia caja", n(turnoCajera?.fondoInicial) === 300);

await cajera.goto(`${BASE}/panel/caja/comprobantes`);
await formaConfirmar(comp1.id).getByRole("button", { name: "Confirmar y registrar el pago" }).click();
await cajera.locator(`[data-comprobante-pendiente="${comp1.id}"]`).waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
const comp1Despues = await db.comprobantePago.findUnique({ where: { id: comp1.id }, include: { pago: true } });
comprobar("Confirmar registra el pago y marca el comprobante", comp1Despues.estado === "CONFIRMADO" && Boolean(comp1Despues.pago));
comprobar("El pago queda en la caja de quien confirmo, con los datos del comprobante",
  comp1Despues.pago?.turnoId === turnoCajera.id && n(comp1Despues.pago?.montoTotal) === 1000 && comp1Despues.pago?.referencia === "SPEI-ALU-1" && comp1Despues.pago?.metodoPago === "TRANSFERENCIA");
comprobar("Y salda el cargo del alumno", n((await db.cargo.findUnique({ where: { id: cargoA1.id } })).saldo) === 0);
comprobar("Confirmar no duplica el pago", (await db.pago.count({ where: { claveCaptura: `comprobante-${comp1.id}` } })) === 1);

// Rechazo con motivo
const formaRechazo = cajera.locator(`[data-rechazar-comprobante="${comp2.id}"]`);
await formaRechazo.getByRole("button", { name: "Rechazar" }).click();
await cajera.waitForTimeout(2000);
comprobar("Rechazar pide el motivo", (await formaRechazo.innerText()).includes("motivo") && (await db.comprobantePago.findUnique({ where: { id: comp2.id } })).estado === "POR_VERIFICAR");
await formaRechazo.getByLabel(/^Motivo del rechazo/).fill("El deposito no aparece en el banco");
await formaRechazo.getByRole("button", { name: "Rechazar" }).click();
await cajera.locator(`[data-comprobante-pendiente="${comp2.id}"]`).waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
const comp2Despues = await db.comprobantePago.findUnique({ where: { id: comp2.id } });
comprobar("Lo rechaza con su motivo", comp2Despues.estado === "RECHAZADO" && comp2Despues.motivoRechazo === "El deposito no aparece en el banco");
comprobar("Los revisados quedan en la lista", (await cajera.locator("[data-comprobante-revisado]").count()) === 2);

// El alumno ve el resultado
await alumno.goto(`${BASE}/panel/estado-de-cuenta`);
const confirmado = alumno.locator('[data-mi-comprobante="CONFIRMADO"]');
const rechazado = (await alumno.locator('[data-mi-comprobante="RECHAZADO"]').innerText()).replace(/\s+/g, " ");
comprobar("El alumno ve su comprobante confirmado y el rechazado con el motivo", (await confirmado.count()) === 1 && rechazado.includes("El deposito no aparece en el banco"));
await confirmado.getByRole("link", { name: "Recibo" }).click();
await alumno.waitForURL(/\/panel\/finanzas\/recibo\/\d+/, { timeout: 15000 });
const reciboAlumno = await texto(alumno);
comprobar("Y abre su recibo", /recibo de pago/i.test(reciboAlumno) && reciboAlumno.includes("$1,000.00") && reciboAlumno.includes("SPEI-ALU-1"), reciboAlumno.slice(0, 300));
await alumno.goto(`${BASE}/panel/estado-de-cuenta`);
await subirComprobante({ monto: 500, referencia: "DEP-ALU-2", archivo: png });
comprobar("Tras un rechazo puede volver a enviar esa referencia", (await db.comprobantePago.count({ where: { referencia: "DEP-ALU-2" } })) === 2);

// ---------------- La cajera cobra en ventanilla (estado de cuenta de solo lectura) ----------------
await cajera.goto(`${BASE}/panel/caja`);
await cajera.getByLabel("Buscar alumno").fill(referenciaEsperada(a2.id));
await cajera.getByRole("button", { name: "Buscar" }).click();
const resultados = (await cajera.locator("[data-resultados-caja]").innerText()).replace(/\s+/g, " ");
comprobar("En caja encuentra al alumno por su referencia de pago", resultados.includes("2026-0002"), resultados);
await cajera.locator("[data-resultados-caja] a").first().click();
await cajera.locator("[data-formulario-pago]").waitFor({ timeout: 15000 });
comprobar("La tarjeta de caja muestra su referencia", (await texto(cajera)).includes(`referencia de pago ${referenciaEsperada(a2.id)}`));
const f = cajera.locator("[data-formulario-pago]");
await f.getByLabel(/^Monto recibido/).fill("800");
await f.getByLabel(/^Metodo de pago/).selectOption("EFECTIVO");
await f.getByRole("button", { name: "Registrar pago" }).click();
await cajera.waitForURL(/\/panel\/finanzas\/recibo\/\d+/, { timeout: 20000 });
comprobar("Cobra en su caja y abre el recibo", /recibo de pago/i.test(await texto(cajera)));
comprobar("El cobro queda en su turno", (await db.pago.findFirst({ where: { alumnoId: a2.id }, orderBy: { id: "desc" } }))?.turnoId === turnoCajera.id);

await cajera.goto(`${BASE}/panel/finanzas/alumno/${a2.id}`);
const cuenta = await texto(cajera);
comprobar("Ve el estado de cuenta completo con la referencia", (await cajera.locator("[data-referencia-alumno]").innerText()).trim() === referenciaEsperada(a2.id) && cuenta.includes("Torres"));
comprobar("La cajera no ve cargo manual, convenios, condonar ni el expediente",
  !cuenta.includes("Cargo manual") && !/convenio/i.test(cuenta) && (await cajera.getByRole("link", { name: "Ver expediente" }).count()) === 0 && (await cajera.getByRole("button", { name: /Condonar|Cancelar cargo/ }).count()) === 0);
comprobar("No puede cancelar pagos", (await cajera.getByRole("button", { name: "Cancelar pago" }).count()) === 0);

// ---------------- Cortes: solo los suyos ----------------
const usuarioAdmin = await db.usuario.findUnique({ where: { usuario: "admin" } });
const turnoAdmin = await db.turnoCaja.create({ data: { usuarioId: usuarioAdmin.id, usuarioNombre: "Administracion", fondoInicial: 0 } });
await cajera.goto(`${BASE}/panel/caja/corte/${turnoAdmin.id}`);
comprobar("No ve el corte de otro cajero", /no (se )?encontr|404|not found/i.test(await cajera.locator("body").innerText()));
await cajera.goto(`${BASE}/panel/caja`);
await cajera.locator("[data-cerrar-caja]").getByLabel(/^Efectivo contado/).fill("1100");
await cajera.getByRole("button", { name: "Cerrar caja y hacer el corte" }).click();
await cajera.waitForURL(/\/panel\/caja\/corte\/\d+\?cerrado=1/, { timeout: 20000 });
const cerrado = await db.turnoCaja.findUnique({ where: { id: turnoCajera.id } });
comprobar("Hace su corte: el efectivo cuadra (fondo + efectivo; la transferencia no cuenta)", cerrado.estado === "CERRADO" && n(cerrado.efectivoEsperado) === 1100 && n(cerrado.diferencia) === 0);
await cajera.goto(`${BASE}/panel/caja/cortes`);
const cortes = await texto(cajera);
comprobar("En Mis cortes solo aparece el suyo", cortes.includes(`Cajera${sello}`) && !cortes.includes("Administracion ·") && (await cajera.locator("a[href^='/panel/caja/corte/']").count()) === 1);
await db.turnoCaja.delete({ where: { id: turnoAdmin.id } });

// ---------------- Cambiar el acceso despues ----------------
await admin.goto(`${BASE}/panel/personal/${empleadoCajera.id}`);
await admin.getByLabel(/^Acceso al sistema/).selectOption("ADMIN");
await admin.getByRole("button", { name: "Guardar cambios" }).click();
await admin.getByText(/Su acceso ahora es Administracion/).waitFor({ timeout: 15000 }).catch(() => {});
comprobar("Administracion puede cambiar el acceso despues", (await db.usuario.findUnique({ where: { id: empleadoCajera.usuarioId } })).rol === "ADMIN");
comprobar("Y cierra sus sesiones abiertas", (await db.sesion.count({ where: { usuarioId: empleadoCajera.usuarioId, revocada: false } })) === 0);
await cajera.goto(`${BASE}/panel/caja`);
comprobar("La cajera tiene que volver a entrar", cajera.url().includes("/acceso"), cajera.url());
await admin.goto(`${BASE}/panel/personal/${empleadoCajera.id}`);
await admin.getByLabel(/^Acceso al sistema/).selectOption("DOCENTE");
await admin.getByRole("button", { name: "Guardar cambios" }).click();
await admin.waitForTimeout(2500);
comprobar("No da acceso de Docente a quien no imparte clases", (await texto(admin)).includes("Imparte clases") && (await db.usuario.findUnique({ where: { id: empleadoCajera.usuarioId } })).rol === "ADMIN");
await admin.goto(`${BASE}/panel/personal/${empleadoCajera.id}`);
await admin.getByLabel(/^Acceso al sistema/).selectOption("CAJERO");
await admin.getByRole("button", { name: "Guardar cambios" }).click();
await admin.getByText(/Su acceso ahora es Caja/).waitFor({ timeout: 15000 }).catch(() => {});
comprobar("Y regresarlo a Caja", (await db.usuario.findUnique({ where: { id: empleadoCajera.usuarioId } })).rol === "CAJERO");

// ---------------- Panel de la administracion ----------------
await admin.goto(`${BASE}/panel`);
comprobar("La administracion tambien ve el aviso de comprobantes", (await admin.locator("[data-aviso-comprobantes]").innerText()).includes("1 comprobante(s)"));

// ---------------- Generar cargos por matricula ----------------
await admin.goto(`${BASE}/panel/finanzas`);
await admin.getByLabel(/^Solo un alumno \(matricula\)/).fill("2026-9999");
await admin.getByRole("button", { name: "Ver que se generaria" }).click();
await admin.waitForTimeout(3000);
comprobar("Con una matricula que no existe lo dice", (await texto(admin)).includes("No hay ningun alumno con la matricula 2026-9999"));
const antesA3 = await db.cargo.count({ where: { alumnoId: a3.id } });
const antesOtros = await db.cargo.count({ where: { alumnoId: { not: a3.id } } });
await admin.goto(`${BASE}/panel/finanzas`);
await admin.getByLabel(/^Solo un alumno \(matricula\)/).fill("2026-0003");
await admin.getByRole("button", { name: "Generar cargos" }).click();
await admin.getByText(/cargo\(s\) generados/).first().waitFor({ timeout: 20000 }).catch(() => {});
const despuesA3 = await db.cargo.count({ where: { alumnoId: a3.id } });
comprobar("Genera los cargos solo de ese alumno por su matricula",
  despuesA3 > antesA3 && (await db.cargo.count({ where: { alumnoId: { not: a3.id } } })) === antesOtros, `${antesA3} -> ${despuesA3}`);

await navegador.close();
await db.$disconnect();
if (fallos.length) {
  console.log(`\nFALLARON ${fallos.length}: ${fallos.join(" | ")}`);
  process.exit(1);
}
console.log("\nTODAS LAS PRUEBAS DE COBRANZA PASARON");
