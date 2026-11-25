import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

// Agregar carreras, certificaciones (programas cortos) y niveles desde
// Estructura academica; editarlas, darlas de baja y reactivarlas. Requiere
// una base recien sembrada con los datos de demostracion y DATABASE_URL.

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const db = new PrismaClient();
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const texto = async (p) => (await p.locator("main").innerText()).replace(/\s+/g, " ");

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

// ---------------- Nivel nuevo ----------------
await admin.goto(`${BASE}/panel/academico`);
const nivelForm = admin.locator("[data-nuevo-nivel]");
async function crearNivel(nombre, clave, modalidad, espera) {
  await nivelForm.getByLabel(/^Nombre del nivel/).fill(nombre);
  await nivelForm.getByLabel(/^Clave del nivel/).fill(clave);
  await nivelForm.getByLabel(/^Modalidad habitual/).selectOption(modalidad);
  await nivelForm.getByRole("button", { name: "Crear nivel" }).click();
  await admin.getByText(espera).first().waitFor({ timeout: 15000 }).catch(() => {});
  return texto(admin);
}
let r = await crearNivel("Educacion continua", "ec", "MODULAR", /Nivel Educacion continua creado/);
comprobar("Crea un nivel nuevo", r.includes("Nivel Educacion continua creado"));
const ec = await db.nivelEducativo.findUnique({ where: { clave: "EC" } });
comprobar("Guarda la clave en mayusculas y su modalidad", ec?.tipoPeriodo === "MODULAR");
await admin.goto(`${BASE}/panel/academico`);
r = await crearNivel("educacion continua", "EC2", "SEMESTRE", /Ya existe el nivel/);
comprobar("No repite un nivel con el mismo nombre", r.includes("Ya existe el nivel Educacion continua"));

// ---------------- Certificacion nueva ----------------
await admin.goto(`${BASE}/panel/academico`);
comprobar("El nivel nuevo aparece vacio con la opcion de agregarle", (await texto(admin)).includes("Aun sin carreras ni certificaciones"));
await admin.locator(`a[href="/panel/academico/nuevo?nivel=${ec.id}"]`).click();
await admin.waitForURL(/\/panel\/academico\/nuevo/);
comprobar("Llega con el nivel elegido y su modalidad", (await admin.getByLabel(/^Modalidad/).inputValue()) === "MODULAR");

async function crearPrograma({ tipo, nombre, clave, titulo = "", periodos, plantilla, modalidad, espera = /\/panel\/academico\/plan\/\d+\?creado=1/ }) {
  await admin.getByLabel(tipo === "CARRERA" ? /^Carrera/ : /^Certificacion/).check();
  await admin.getByLabel(/^Nombre\*?$/).fill(nombre);
  await admin.getByLabel(/^Clave\*?$/).fill(clave);
  await admin.getByLabel(/^Titulo que otorga/).fill(titulo);
  if (modalidad) await admin.getByLabel(/^Modalidad/).selectOption(modalidad);
  if (periodos) await admin.getByLabel(/^Numero de periodos/).fill(String(periodos));
  if (plantilla) await admin.getByLabel(/^Nombre de cada periodo/).fill(plantilla);
  await admin.getByRole("button", { name: tipo === "CARRERA" ? "Crear carrera" : "Crear certificacion" }).click();
  if (espera instanceof RegExp && espera.source.startsWith("\\/panel")) await admin.waitForURL(espera, { timeout: 20000 }).catch(() => {});
  else await admin.getByText(espera).first().waitFor({ timeout: 15000 }).catch(() => {});
  return texto(admin);
}
await admin.getByLabel(/^Certificacion/).check();
comprobar("Para una certificacion propone un solo periodo", (await admin.getByLabel(/^Numero de periodos/).inputValue()) === "1");
await admin.getByLabel(/^Numero de periodos/).fill("3");
comprobar("Muestra como quedan los periodos", (await admin.locator("[data-vista-periodos]").innerText()).includes("Modulo 3"));
r = await crearPrograma({ tipo: "CERTIFICACION", nombre: "Certificacion en Excel avanzado", clave: "cert-excel", titulo: "Certificado en Excel avanzado", periodos: 3 });
comprobar("Crea la certificacion y lleva a su pagina", admin.url().includes("creado=1") && r.includes("Certificacion creada con sus 3 periodo(s)"), admin.url());
const cert = await db.planEstudios.findUnique({ where: { clave: "CERT-EXCEL" }, include: { grados: { orderBy: { numero: "asc" } }, _count: { select: { materias: true } } } });
comprobar("Se guarda como certificacion, con su titulo y nivel",
  cert?.tipo === "CERTIFICACION" && cert.tituloOtorga === "Certificado en Excel avanzado" && cert.nivelId === ec.id && cert.modalidad === "MODULAR");
comprobar("Con sus periodos y sin materias", cert.grados.map((g) => g.nombre).join(",") === "Modulo 1,Modulo 2,Modulo 3" && cert._count.materias === 0);
comprobar("Invita a cargar sus materias en el mapa curricular", (await admin.locator(`a[href="/panel/materias/plan/${cert.id}"]`).count()) >= 1);

// ---------------- Carrera nueva y validaciones ----------------
await admin.goto(`${BASE}/panel/academico/nuevo`);
r = await crearPrograma({ tipo: "CARRERA", nombre: "Bachillerato Tecnologico", clave: "BG-01", espera: /Ya existe/ });
comprobar("No repite la clave de otra carrera", r.includes("Ya existe una carrera o certificacion con la clave BG-01"));
r = await crearPrograma({ tipo: "CARRERA", nombre: "Bachillerato Tecnologico", clave: "BT 01", espera: /La clave debe/ });
comprobar("Valida la clave", r.includes("La clave debe tener"));
r = await crearPrograma({ tipo: "CARRERA", nombre: "Bachillerato Tecnologico", clave: "BT-01", plantilla: "Semestre", espera: /debe llevar/ });
comprobar("Valida el nombre de los periodos", r.includes("debe llevar {N}"));
await admin.goto(`${BASE}/panel/academico/nuevo`);
r = await crearPrograma({ tipo: "CARRERA", nombre: "Bachillerato Tecnologico", clave: "BT-01", titulo: "Tecnico en Programacion", modalidad: "SEMESTRE", periodos: 6, plantilla: "{N}o Semestre" });
const bt = await db.planEstudios.findUnique({ where: { clave: "BT-01" }, include: { grados: true } });
comprobar("Crea una carrera con 6 semestres", bt?.tipo === "CARRERA" && bt.grados.length === 6, r.slice(0, 120));

await admin.goto(`${BASE}/panel/academico`);
const lista = await texto(admin);
comprobar("Estructura academica las muestra con su tipo y titulo",
  (await admin.locator('[data-programa="CERT-EXCEL"]').innerText()).includes("Certificacion") &&
    lista.includes("Otorga: Certificado en Excel avanzado") &&
    (await admin.locator('[data-programa="BT-01"]').innerText()).includes("Carrera"));

// ---------------- Ya se puede usar ----------------
await admin.goto(`${BASE}/panel/alumnos/nuevo`);
const planesAlta = await admin.getByLabel(/^Plan de estudios\*?$/).locator("option").allTextContents();
comprobar("Aparece al dar de alta alumnos", planesAlta.some((o) => o.includes("Certificacion en Excel avanzado")) && planesAlta.some((o) => o.includes("Bachillerato Tecnologico")));
await admin.goto(`${BASE}/panel/grupos`);
const planesGrupo = await admin.getByLabel(/^Plan de estudios\*?$/).locator("option").allTextContents();
comprobar("Aparece al abrir un grupo", planesGrupo.some((o) => o.includes("Certificacion en Excel avanzado")));

// ---------------- Editar ----------------
await admin.goto(`${BASE}/panel/academico/plan/${cert.id}`);
const editar = admin.locator("[data-editar-programa]");
await editar.getByLabel(/^Nombre\*?$/).fill("Certificacion en Excel y Power BI");
await editar.getByLabel(/^Titulo que otorga/).fill("Certificado en analisis de datos");
await editar.getByRole("button", { name: "Guardar datos" }).click();
await admin.getByText("Datos guardados.").waitFor({ timeout: 15000 }).catch(() => {});
const editada = await db.planEstudios.findUnique({ where: { id: cert.id } });
comprobar("Edita nombre y titulo", editada.nombre === "Certificacion en Excel y Power BI" && editada.tituloOtorga === "Certificado en analisis de datos");
comprobar("La edicion queda en la bitacora con antes y despues",
  Boolean(await db.bitacora.findFirst({ where: { entidad: "PlanEstudios", entidadId: String(cert.id), accion: "ACTUALIZAR", NOT: { datosAntes: { equals: null } } } })));

// Mientras no tenga alumnos ni grupos puede cambiar de nivel.
const bach = await db.nivelEducativo.findFirst({ where: { NOT: { id: ec.id } }, orderBy: { orden: "asc" } });
await editar.getByLabel(/^Nivel/).selectOption(String(bach.id));
await editar.getByRole("button", { name: "Guardar datos" }).click();
await admin.waitForTimeout(1500);
comprobar("Sin alumnos ni grupos puede cambiar de nivel", (await db.planEstudios.findUnique({ where: { id: cert.id } })).nivelId === bach.id);

const bg = await db.planEstudios.findUnique({ where: { clave: "BG-01" } });
await admin.goto(`${BASE}/panel/academico/plan/${bg.id}`);
comprobar("Con alumnos el nivel queda bloqueado", await admin.locator("[data-editar-programa]").getByLabel(/^Nivel/).isDisabled());
await admin.locator("[data-editar-programa]").getByLabel(/^Clave\*?$/).fill("BT-01");
await admin.locator("[data-editar-programa]").getByRole("button", { name: "Guardar datos" }).click();
await admin.getByText(/Ya existe/).first().waitFor({ timeout: 15000 }).catch(() => {});
comprobar("Al editar tampoco deja repetir la clave", (await texto(admin)).includes("Ya existe una carrera o certificacion con la clave BT-01"));

// ---------------- Baja y reactivacion ----------------
await admin.goto(`${BASE}/panel/academico/plan/${bg.id}`);
await admin.locator("[data-oferta]").getByRole("button", { name: "Dar de baja" }).click();
await admin.waitForURL(/oferta=baja/, { timeout: 15000 });
await admin.getByText(/Dada de baja/).waitFor({ timeout: 15000 }).catch(() => {});
comprobar("Dar de baja avisa que los alumnos actuales terminan", (await texto(admin)).includes("Quienes ya la cursan terminan"));
const bgBaja = await db.planEstudios.findUnique({ where: { id: bg.id }, include: { _count: { select: { alumnos: true } } } });
comprobar("No borra nada: sigue con sus alumnos", bgBaja._count.alumnos === 4 && bgBaja.vigenteHasta !== null);
await admin.goto(`${BASE}/panel/alumnos/nuevo`);
comprobar("Ya no aparece para nuevo ingreso",
  !(await admin.getByLabel(/^Plan de estudios\*?$/).locator("option").allTextContents()).some((o) => o.includes("Bachillerato General")));
await admin.goto(`${BASE}/panel/academico`);
comprobar("En la estructura se marca sin nuevo ingreso", (await admin.locator('[data-programa="BG-01"]').innerText()).includes("sin nuevo ingreso"));
await admin.goto(`${BASE}/panel/academico/plan/${bg.id}`);
await admin.locator("[data-oferta]").getByRole("button", { name: "Volver a ofrecer" }).click();
await admin.waitForURL(/oferta=reactivada/, { timeout: 15000 });
await admin.goto(`${BASE}/panel/alumnos/nuevo`);
comprobar("Al reactivarla vuelve a aparecer",
  (await admin.getByLabel(/^Plan de estudios\*?$/).locator("option").allTextContents()).some((o) => o.includes("Bachillerato General")));

// ---------------- Documentos y permisos ----------------
await admin.goto(`${BASE}/panel/documentos/machotes`); // el catalogo se crea al abrir Documentos
const machote = await db.plantillaDocumento.findFirst({ orderBy: { id: "asc" } });
await admin.goto(`${BASE}/panel/documentos/machotes/${machote.id}`);
comprobar("Los machotes ofrecen el campo del titulo que otorga", (await admin.content()).includes("alumno.titulo_otorga"));

const docente = await entrar("docente");
await docente.goto(`${BASE}/panel/academico/nuevo`);
comprobar("Un docente no puede agregar carreras", !docente.url().includes("/panel/academico/nuevo"));
comprobar("Todo queda en la bitacora", (await db.bitacora.count({ where: { entidad: { in: ["PlanEstudios", "NivelEducativo"] } } })) >= 7);

await navegador.close();
await db.$disconnect();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DE CARRERAS Y CERTIFICACIONES PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
