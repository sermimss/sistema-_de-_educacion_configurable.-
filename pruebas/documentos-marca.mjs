import { chromium } from "playwright";

// Identidad de marca y documentos institucionales. Requiere una base recien
// sembrada con los datos de demostracion (SEED_DEMO=1).

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const limpio = async (p) => (await p.textContent("body")).replace(/\s+/g, " ");

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function sesion(usuario, password) {
  const contexto = await navegador.newContext();
  const p = await contexto.newPage();
  p.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));
  await p.goto(`${BASE}/acceso`);
  await p.getByLabel(/^Usuario, matricula o correo\*?$/).fill(usuario);
  await p.getByLabel(/^Contrasena\*?$/).fill(password);
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.waitForURL("**/panel", { timeout: 20000 });
  return p;
}

// Imagenes de prueba dibujadas en el navegador: un escudo verde con una banda
// dorada (el logo), una firma y un sello.
const admin = await sesion("admin", "Demo1234");
const imagenes = await admin.evaluate(() => {
  const hacer = (w, h, dibujar) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    dibujar(c.getContext("2d"));
    return c.toDataURL("image/png").split(",")[1];
  };
  return {
    logo: hacer(400, 400, (g) => {
      g.fillStyle = "#15803d";
      g.beginPath();
      [[200, 20], [370, 80], [340, 300], [200, 380], [60, 300], [30, 80]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.fill();
      g.fillStyle = "#ca8a04";
      g.fillRect(60, 170, 280, 60);
    }),
    firma: hacer(500, 160, (g) => {
      g.strokeStyle = "#1e2963";
      g.lineWidth = 6;
      g.beginPath();
      [[20, 120], [80, 40], [140, 130], [200, 50], [330, 60], [480, 90]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    }),
    sello: hacer(300, 300, (g) => {
      g.strokeStyle = "#5b21b6";
      g.lineWidth = 14;
      g.beginPath();
      g.arc(150, 150, 135, 0, 7);
      g.stroke();
    }),
  };
});
const archivo = (nombre, base64) => ({ name: nombre, mimeType: "image/png", buffer: Buffer.from(base64, "base64") });

// ---------------- Identidad: el logo ----------------
await admin.goto(`${BASE}/panel/configuracion`);
await admin.locator("#logo").setInputFiles({ name: "falso.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)></svg>") });
await admin.getByRole("button", { name: "Guardar identidad" }).click();
await admin.waitForTimeout(1500);
comprobar("Rechaza un archivo que no es imagen aunque se llame .png", (await limpio(admin)).includes("PNG, JPG o WebP"));

await admin.goto(`${BASE}/panel/configuracion`);
await admin.locator("#logo").setInputFiles(archivo("escudo.png", imagenes.logo));
await admin.waitForSelector("text=Tomamos los colores del logo", { timeout: 10000 });
const primario = await admin.getByLabel("Color principal").inputValue();
const secundario = await admin.getByLabel("Color secundario").inputValue();
const canal = (hex, i) => parseInt(hex.slice(i, i + 2), 16);
comprobar("Toma el color principal del logo (verde)", canal(primario, 3) > canal(primario, 1) + 40 && canal(primario, 3) > canal(primario, 5) + 40, primario);
comprobar("Toma el secundario del logo (dorado)", canal(secundario, 1) > 150 && canal(secundario, 5) < 80, secundario);
comprobar("Muestra la vista previa con el logo", await admin.locator("[data-vista-previa-marca] img").count() === 1);
await admin.getByLabel("Ciudad", { exact: true }).fill("Morelia");
await admin.getByLabel("Estado", { exact: true }).fill("Michoacan");
await admin.getByRole("button", { name: "Guardar identidad" }).click();
await admin.waitForSelector("text=Identidad de la institucion actualizada", { timeout: 15000 });

await admin.goto(`${BASE}/panel`);
const estilo = await admin.locator("body").getAttribute("style");
comprobar("Todo el colegio usa el color del logo", estilo.includes(`--marca-base:${primario}`) || estilo.includes(`--marca-base: ${primario}`), estilo);
const srcLogo = await admin.locator("aside img").first().getAttribute("src");
comprobar("El logo aparece en el menu del colegio", srcLogo?.startsWith("/api/marca/logo"), srcLogo);
const icono = await admin.locator('link[rel="icon"]').getAttribute("href").catch(() => null);
comprobar("El logo es el icono de la pestana", icono?.includes("/api/marca/logo"), icono);
const respuestaLogo = await admin.request.get(`${BASE}${srcLogo}`);
comprobar("El logo se sirve como imagen", respuestaLogo.status() === 200 && respuestaLogo.headers()["content-type"] === "image/png");

const anonimo = await (await navegador.newContext()).newPage();
await anonimo.goto(`${BASE}/acceso`);
comprobar("El logo aparece en la pantalla de acceso", (await anonimo.locator("main img").first().getAttribute("src"))?.startsWith("/api/marca/logo"));

// Con un color claro, el texto de los botones cambia a oscuro para leerse.
await admin.goto(`${BASE}/panel/configuracion`);
await admin.getByLabel("Color principal").fill("#facc15");
await admin.getByRole("button", { name: "Guardar identidad" }).click();
await admin.waitForSelector("text=Identidad de la institucion actualizada", { timeout: 15000 });
await admin.goto(`${BASE}/panel`);
comprobar("Con un color claro el texto de los botones se vuelve oscuro",
  (await admin.locator("body").getAttribute("style")).includes("--marca-contraste:#0f172a"));
await admin.goto(`${BASE}/panel/configuracion`);
await admin.getByLabel("Color principal").fill(primario);
await admin.getByRole("button", { name: "Guardar identidad" }).click();
await admin.waitForSelector("text=Identidad de la institucion actualizada", { timeout: 15000 });

// ---------------- Firmantes ----------------
await admin.goto(`${BASE}/panel/documentos/firmantes`);
await admin.getByLabel(/^Nombre de quien firma\*?$/).first().fill("Mtra. Ana Direccion");
await admin.getByLabel(/^Cargo\*?$/).first().fill("Directora General");
await admin.locator('input[name="firma"]').first().setInputFiles(archivo("firma.png", imagenes.firma));
await admin.locator('input[name="sello"]').first().setInputFiles(archivo("sello.png", imagenes.sello));
await admin.getByRole("button", { name: "Agregar firmante" }).click();
await admin.waitForSelector("text=Firmante agregado", { timeout: 15000 });

await admin.goto(`${BASE}/panel/documentos/machotes`);
await admin.getByRole("button", { name: "Asignar a los que no tienen" }).click();
await admin.waitForSelector("text=Se asigno a 19 machote", { timeout: 15000 });
comprobar("Asigna el firmante a los 19 machotes", true);

// ---------------- Catalogo ----------------
await admin.goto(`${BASE}/panel/documentos`);
const catalogo = await limpio(admin);
comprobar("Documentos aparece en el menu de control escolar", (await admin.locator("aside").textContent()).includes("Documentos"));
for (const nombre of ["Constancia de estudios", "Constancia de terminacion de estudios", "Oficio de presentacion para practicas profesionales",
  "Hoja de control de practicas", "Pase de salida", "Pase de entrada", "Justificante de inasistencia", "Hoja de descuento al personal", "Oficio membretado"]) {
  if (!catalogo.includes(nombre)) comprobar(`El catalogo trae ${nombre}`, false);
}
comprobar("El catalogo trae los 19 machotes", (await admin.locator('a[href^="/panel/documentos/generar/"]').count()) === 19);

async function abrirMachote(nombre) {
  await admin.goto(`${BASE}/panel/documentos`);
  await admin.getByRole("link", { name: new RegExp(`^${nombre}`) }).first().click();
  await admin.waitForURL(/\/panel\/documentos\/generar\/\d+/);
}
async function elegirPersona(busqueda, nombre) {
  await admin.getByLabel("Buscar persona").fill(busqueda);
  await admin.getByRole("button", { name: "Buscar" }).click();
  await admin.getByRole("link", { name: new RegExp(nombre) }).first().click();
  await admin.waitForSelector("[data-vista-previa]");
}
async function generar() {
  await admin.getByRole("button", { name: "Generar documento" }).click();
  await admin.waitForURL(/\/panel\/documentos\/emitidos\/\d+/, { timeout: 20000 });
  return { url: admin.url(), texto: await limpio(admin) };
}

// ---------------- Constancia de estudios ----------------
await abrirMachote("Constancia de estudios");
await elegirPersona("Ramirez", "Ramirez Lopez Sofia");
const previa = (await admin.locator("[data-vista-previa]").textContent()).replace(/\s+/g, " ");
comprobar("La vista previa ya trae los datos reales del alumno",
  previa.includes("Sofia Ramirez Lopez") && previa.includes("2026-0001") && previa.includes("grupo 1A") && previa.includes("17 de agosto de 2026"), previa.slice(0, 300));
comprobar("La vista previa trae la fecha con la ciudad del colegio", previa.includes("Morelia, Michoacan, a"));
const constancia = await generar();
comprobar("Genera la constancia con folio", constancia.texto.includes("CE-2026-0001"));
comprobar("La constancia lleva el logo del colegio", (await admin.locator("[data-documento] [data-logo-documento]").count()) === 1);
comprobar("La constancia lleva firma y sello", (await admin.locator("[data-firma]").count()) === 1 && (await admin.locator("[data-sello]").count()) === 1);
comprobar("La constancia lleva nombre y cargo de quien firma", constancia.texto.includes("Mtra. Ana Direccion") && constancia.texto.includes("Directora General"));
comprobar("No quedan campos sin llenar", !constancia.texto.includes("{{"));
const colorBanda = await admin.locator("[data-documento] header div").nth(2).evaluate((e) => getComputedStyle(e).backgroundColor);
comprobar("La hoja usa el color institucional", colorBanda !== "rgba(0, 0, 0, 0)", colorBanda);
await admin.emulateMedia({ media: "print" });
comprobar("Al imprimir se ocultan el menu y los botones", !(await admin.locator("aside").isVisible()) && !(await admin.getByRole("button", { name: /Imprimir/ }).isVisible()));
await admin.emulateMedia({ media: "screen" });

// ---------------- Pase de salida (datos que se piden al generar) ----------------
await abrirMachote("Pase de salida");
await elegirPersona("2026-0002", "Torres Mendez Diego");
await admin.getByLabel(/^Fecha\*?$/).fill("2026-10-26");
await admin.getByLabel(/^Hora de salida\*?$/).fill("11:30");
await admin.getByLabel(/^Motivo\*?$/).fill("Cita medica");
await admin.getByLabel(/^Persona que recoge al alumno$/).fill("Laura Mendez");
const pase = await generar();
comprobar("El pase lleva los datos capturados", pase.texto.includes("11:30") && pase.texto.includes("Cita medica") && pase.texto.includes("Laura Mendez"));
comprobar("El pase tiene su propio folio", pase.texto.includes("PS-2026-0001"));

// ---------------- Personal ----------------
await abrirMachote("Hoja de descuento al personal");
await elegirPersona("Hernandez", "Hernandez Luis");
await admin.getByLabel(/^Concepto del descuento\*?$/).fill("Retardos acumulados");
await admin.getByLabel(/^Monto a descontar\*?$/).fill("350");
await admin.getByLabel(/^Periodo de pago en que se aplica\*?$/).fill("1a quincena de noviembre");
await admin.getByLabel(/^Motivo\*?$/).fill("Tres retardos en octubre");
const descuento = await generar();
comprobar("La hoja de descuento busca al docente y su puesto", descuento.texto.includes("Luis Hernandez") && descuento.texto.includes("Docente de Ciencias"));
comprobar("El monto sale con formato de moneda", descuento.texto.includes("$350.00"));
const idDescuento = descuento.url.match(/emitidos\/(\d+)/)[1];

// ---------------- Constancia con calificaciones ----------------
await abrirMachote("Constancia de estudios con calificaciones");
await elegirPersona("2026-0001", "Ramirez Lopez Sofia");
const conCalif = await generar();
comprobar("La constancia con calificaciones trae su tabla", conCalif.texto.includes("Matematicas I") || conCalif.texto.includes("Sin calificaciones registradas"));

// ---------------- Editar un machote ----------------
await admin.goto(`${BASE}/panel/documentos/machotes`);
await admin.getByRole("row", { name: /Constancia de estudios propio|^Constancia de estudios Alumnos/ }).getByRole("link", { name: "Editar" }).first().click();
await admin.waitForURL(/machotes\/\d+/);
const texto = await admin.getByLabel("Texto del documento").inputValue();
await admin.getByLabel("Texto del documento").fill(`${texto}\n\nCampo roto {{alumno.inexistente}}`);
await admin.getByRole("button", { name: "Guardar machote" }).click();
await admin.waitForTimeout(1500);
comprobar("Avisa si el texto usa un campo que no existe", (await limpio(admin)).includes("{{alumno.inexistente}}"));
await admin.getByLabel("Texto del documento").fill(`${texto}\n\nTEXTO EDITADO POR EL COLEGIO para {{alumno.nombres}}.`);
await admin.getByRole("button", { name: "Guardar machote" }).click();
await admin.waitForSelector("text=Machote guardado", { timeout: 15000 });
await abrirMachote("Constancia de estudios");
await elegirPersona("2026-0001", "Ramirez Lopez Sofia");
const editada = await generar();
comprobar("El documento sale con el texto editado y el dato real", editada.texto.includes("TEXTO EDITADO POR EL COLEGIO para Sofia."));
comprobar("El folio sigue el consecutivo", editada.texto.includes("CE-2026-0002"));

// ---------------- Machote propio ----------------
await admin.goto(`${BASE}/panel/documentos/machotes/nuevo`);
await admin.getByLabel(/^Nombre del machote\*?$/).fill("Invitacion a ceremonia");
await admin.getByLabel(/^Prefijo del folio\*?$/).fill("IC");
await admin.getByLabel("Titulo del documento").fill("INVITACIÓN");
await admin.getByRole("button", { name: "Agregar dato" }).click();
await admin.getByLabel("Nombre del dato").fill("Fecha de la ceremonia");
await admin.getByLabel("Tipo").selectOption("fecha");
await admin.getByLabel("Texto del documento").fill("[derecha]{{documento.ciudad_fecha}}\n\nSe invita a **{{alumno.nombre_completo}}** a la ceremonia del {{extra.fecha_de_la_ceremonia}}.");
await admin.getByRole("button", { name: "Guardar machote" }).click();
await admin.waitForURL(/machotes\/\d+\?creado=1/, { timeout: 15000 });
await abrirMachote("Invitacion a ceremonia");
await elegirPersona("2026-0003", "Nunez Castro Valeria");
await admin.getByLabel(/^Fecha de la ceremonia\*?$/).fill("2026-12-12");
const propio = await generar();
comprobar("Un machote propio funciona igual que los del sistema",
  propio.texto.includes("Valeria Nunez Castro") && propio.texto.includes("12 de diciembre de 2026") && propio.texto.includes("IC-2026-0001"));

// ---------------- Historial y cancelacion ----------------
await admin.goto(`${BASE}/panel/documentos/emitidos`);
const historial = await limpio(admin);
comprobar("El historial guarda cada documento con su folio", ["CE-2026-0001", "CE-2026-0002", "PS-2026-0001", "HD-2026-0001", "IC-2026-0001"].every((f) => historial.includes(f)));
await admin.goto(pase.url);
await admin.getByRole("button", { name: "Cancelar este documento" }).click();
await admin.getByLabel(/^Motivo de la cancelacion\*?$/).fill("Se capturo mal la hora");
await admin.getByRole("button", { name: "Cancelar documento" }).click();
await admin.waitForTimeout(1500);
await admin.reload();
comprobar("Un documento cancelado queda marcado", (await limpio(admin)).includes("CANCELADO"));

// ---------------- Solicitudes desde el portal del alumno ----------------
const alumno = await sesion("2026-0001", "Demo1234");
await alumno.goto(`${BASE}/panel/mis-documentos`);
await alumno.getByLabel(/^Documento\*?$/).selectOption({ label: "Constancia de estudios" });
await alumno.getByLabel("Para que lo necesitas").fill("Tramite de beca");
await alumno.getByRole("button", { name: "Solicitar" }).click();
await alumno.waitForSelector("text=Solicitud enviada", { timeout: 15000 });
await alumno.getByLabel(/^Documento\*?$/).selectOption({ label: "Constancia de estudios" });
await alumno.getByRole("button", { name: "Solicitar" }).click();
await alumno.waitForTimeout(1500);
comprobar("No deja pedir dos veces lo mismo mientras esta en espera", (await limpio(alumno)).includes("en espera"));
await alumno.getByLabel(/^Documento\*?$/).selectOption({ label: "Carta de buena conducta" });
await alumno.getByRole("button", { name: "Solicitar" }).click();
await alumno.waitForSelector("text=Solicitud enviada", { timeout: 15000 });

const ajeno = await alumno.goto(`${BASE}/panel/documentos/emitidos/${idDescuento}`);
comprobar("El alumno no puede ver documentos de otros", ajeno.status() === 404 || (await limpio(alumno)).includes("404"));
await alumno.goto(`${BASE}/panel/documentos`);
comprobar("El alumno no entra a la administracion de documentos", !alumno.url().endsWith("/panel/documentos"));

await admin.goto(`${BASE}/panel/documentos/solicitudes`);
const bandeja = await limpio(admin);
comprobar("Administracion ve las solicitudes con su motivo", bandeja.includes("Tramite de beca") && bandeja.includes("Carta de buena conducta"));
await admin.locator("li", { hasText: "Tramite de beca" }).getByRole("link", { name: "Generar" }).click();
await admin.waitForSelector("[data-vista-previa]");
comprobar("Desde la solicitud el alumno ya viene elegido", (await admin.locator("[data-vista-previa]").textContent()).includes("Sofia Ramirez Lopez"));
const atendida = await generar();
comprobar("Atiende la solicitud con un folio nuevo", atendida.texto.includes("CE-2026-0003"));
await admin.goto(`${BASE}/panel/documentos/solicitudes`);
await admin.locator("li", { hasText: "Carta de buena conducta" }).getByRole("button", { name: "Rechazar" }).click();
await admin.getByLabel("Motivo del rechazo").fill("Debe pasar a Control Escolar con identificacion");
await admin.getByRole("button", { name: "Confirmar" }).click();
await admin.waitForTimeout(1500);

await alumno.goto(`${BASE}/panel/mis-documentos`);
const portal = await limpio(alumno);
comprobar("El alumno ve su constancia lista", portal.includes("lista") && portal.includes("Ver e imprimir"));
comprobar("El alumno ve el motivo del rechazo", portal.includes("no procede") && portal.includes("Debe pasar a Control Escolar"));
await alumno.getByRole("link", { name: "Ver e imprimir" }).first().click();
await alumno.waitForURL(/emitidos\/\d+/);
comprobar("El alumno abre su constancia con logo, firma y sello",
  (await alumno.locator("[data-logo-documento]").count()) === 1 && (await alumno.locator("[data-firma]").count()) === 1 && (await limpio(alumno)).includes("CE-2026-0003"));

const docente = await sesion("docente", "Demo1234");
await docente.goto(`${BASE}/panel/documentos`);
comprobar("El docente no entra a Documentos", !docente.url().endsWith("/panel/documentos"));

await navegador.close();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DE DOCUMENTOS Y MARCA PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
