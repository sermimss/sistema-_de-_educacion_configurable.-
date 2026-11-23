import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";

// Grabaciones de las clases de Google Meet: visibles para los alumnos hasta el
// mismo dia del mes siguiente a la clase. Requiere una base recien sembrada
// con los datos de demostracion y DATABASE_URL de esa base.

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const db = new PrismaClient();
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const limpio = async (p) => (await p.locator("main").innerText()).replace(/\s+/g, " ");

// ---------------- Reglas de fechas y enlaces ----------------
const reglas = JSON.parse(
  execFileSync(
    "npx",
    [
      "tsx",
      "-e",
      `import { fechaDeVencimiento as v, normalizarEnlaceGrabacion as n } from "./src/lib/grabaciones.ts";
       console.log(JSON.stringify({
         marzo: v("2026-03-03"), enero: v("2027-01-31"), bisiesto: v("2028-01-31"), diciembre: v("2026-12-15"), mayo: v("2026-05-31"),
         compartir: n("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp_q-r/view?usp=sharing"),
         abrir: n("drive.google.com/open?id=1AbCdEfGhIjKlMnOp_q-r"),
         llave: n("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp_q-r/view?usp=drive_link&resourcekey=0-abcDEF"),
         youtube: n("https://youtube.com/watch?v=abc"), carpeta: n("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp"),
       }));`,
    ],
    { encoding: "utf8" }
  )
);
comprobar("Clase del 3 de marzo: se ve hasta el 3 de abril", reglas.marzo === "2026-04-03");
comprobar("Clase del 31 de enero: hasta el ultimo dia de febrero", reglas.enero === "2027-02-28" && reglas.bisiesto === "2028-02-29");
comprobar("Diciembre pasa al enero del ano siguiente", reglas.diciembre === "2027-01-15");
comprobar("31 de mayo: hasta el 30 de junio", reglas.mayo === "2026-06-30");
comprobar("Limpia el enlace de Drive que se copia al compartir",
  reglas.compartir.enlace === "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp_q-r/view" &&
    reglas.abrir.enlace === "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp_q-r/view");
comprobar("Conserva la resourcekey que algunos archivos necesitan",
  reglas.llave.enlace === "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp_q-r/view?resourcekey=0-abcDEF");
comprobar("Rechaza enlaces que no son un archivo de Drive", !reglas.youtube.ok && !reglas.carpeta.ok);

// ---------------- Fechas de prueba en la zona del colegio ----------------
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dia = (texto) => new Date(`${texto}T00:00:00.000Z`);
const mover = (texto, dias) => new Date(dia(texto).getTime() + dias * 86400000).toISOString().slice(0, 10);
function vencimiento(texto) {
  const [a, m, d] = texto.split("-").map(Number);
  const na = m === 12 ? a + 1 : a, nm = m === 12 ? 1 : m + 1;
  const ultimo = new Date(Date.UTC(na, nm, 0)).getUTCDate();
  return `${na}-${String(nm).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}
const legible = (texto) => new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(dia(texto));

const clases = await db.clase.findMany({ include: { planMateria: { include: { materia: true } } }, orderBy: { id: "asc" } });
const matematicas = clases.find((c) => c.planMateria.materia.nombre === "Matematicas I");
const lengua = clases.find((c) => c.planMateria.materia.nombre === "Lengua y Literatura");
const drive = (n) => `https://drive.google.com/file/d/1Prueba${n}AbCdEfGhIj/view`;
// Una vencida (clase de hace 40 dias), una que vence hoy y una de hace 20 dias.
const vieja = mover(hoy, -40);
await db.grabacion.createMany({
  data: [
    { claseId: matematicas.id, fechaClase: dia(vieja), disponibleHasta: dia(vencimiento(vieja)), titulo: "Tema 1: conjuntos", enlace: drive(1), autorNombre: "Luis Hernandez" },
    { claseId: matematicas.id, fechaClase: dia(mover(hoy, -30)), disponibleHasta: dia(hoy), titulo: "Tema 2: funciones", enlace: drive(2), autorNombre: "Luis Hernandez" },
    { claseId: lengua.id, fechaClase: dia(mover(hoy, -20)), disponibleHasta: dia(vencimiento(mover(hoy, -20))), titulo: "Lectura de poesia", enlace: drive(3), autorNombre: "Luis Hernandez" },
  ],
});
const [tema1, tema2, poesia] = await db.grabacion.findMany({ orderBy: { id: "asc" } });

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function entrar(usuario, password) {
  const p = await (await navegador.newContext()).newPage();
  p.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));
  await p.goto(`${BASE}/acceso`);
  await p.getByLabel(/^Usuario, matricula o correo\*?$/).fill(usuario);
  await p.getByLabel(/^Contrasena\*?$/).fill(password);
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.waitForURL("**/panel", { timeout: 20000 });
  return p;
}
const abrir = async (p, id) => {
  const r = await p.request.get(`${BASE}/panel/grabaciones/ver/${id}`, { maxRedirects: 0 });
  return { estado: r.status(), destino: r.headers()["location"] ?? "" };
};

// ---------------- El docente comparte la grabacion ----------------
const docente = await entrar("docente", "Demo1234");
await docente.goto(`${BASE}/panel/mis-clases`);
await docente.locator(`a[href="/panel/grabaciones?clase=${matematicas.id}"]`).click();
await docente.waitForURL(/\/panel\/grabaciones\?clase=/);
comprobar("Desde Mis clases llega a las grabaciones de esa clase",
  (await docente.getByLabel(/^Clase\*?$/).inputValue()) === String(matematicas.id));
comprobar("Antes de publicar dice hasta cuando la veran los alumnos",
  (await docente.locator("[data-vence]").innerText()).includes(legible(vencimiento(hoy))));

async function publicar(enlace, titulo = "", fecha = null, espera = /Grabacion publicada/) {
  if (fecha) {
    await docente.getByLabel(/^Fecha de la clase\*?$/).evaluate((el) => el.removeAttribute("max"));
    await docente.getByLabel(/^Fecha de la clase\*?$/).fill(fecha);
  }
  await docente.getByLabel(/^Titulo \(opcional\)$/).fill(titulo);
  await docente.getByLabel(/^Enlace de la grabacion\*?$/).fill(enlace);
  await docente.getByRole("button", { name: "Publicar grabacion" }).click();
  await docente
    .getByText(espera)
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => {});
  return limpio(docente);
}
comprobar("Rechaza un enlace que no es de Google Drive",
  (await publicar("https://www.youtube.com/watch?v=abc", "", null, /Solo se aceptan/)).includes("Solo se aceptan enlaces de Google Drive"));
comprobar("Rechaza una fecha de clase futura",
  (await publicar(drive(9), "", mover(hoy, 1), /posterior a hoy/)).includes("no puede ser posterior a hoy"));
comprobar("Rechaza una clase de hace mas de un mes",
  (await publicar(drive(9), "", mover(hoy, -45), /mas de un mes/)).includes("mas de un mes"));
await docente.goto(`${BASE}/panel/grabaciones?clase=${matematicas.id}`);
const respuesta = await publicar("https://drive.google.com/file/d/1NuevaAbCdEfGhIjKl/view?usp=sharing", "Tema 3: derivadas");
comprobar("Publica la grabacion de hoy y avisa hasta cuando se ve",
  respuesta.includes("Grabacion publicada") && respuesta.includes(legible(vencimiento(hoy))), respuesta.slice(0, 200));
const nueva = await db.grabacion.findFirst({ where: { titulo: "Tema 3: derivadas" } });
comprobar("Guarda el enlace limpio y el vencimiento al mes",
  nueva?.enlace === "https://drive.google.com/file/d/1NuevaAbCdEfGhIjKl/view" &&
    nueva.disponibleHasta.toISOString().slice(0, 10) === vencimiento(hoy));

// ---------------- El alumno ve solo las de menos de un mes ----------------
const alumno = await entrar("2026-0001", "Demo1234");
comprobar("El alumno tiene Grabaciones en su menu", (await alumno.locator("aside").innerText()).includes("Grabaciones"));
await alumno.goto(`${BASE}/panel/grabaciones`);
const listaAlumno = await limpio(alumno);
comprobar("Ve las grabaciones que aun no cumplen el mes",
  ["Tema 3: derivadas", "Tema 2: funciones", "Lectura de poesia"].every((t) => listaAlumno.includes(t)));
comprobar("No ve la que ya cumplio el mes", !listaAlumno.includes("Tema 1: conjuntos"));
comprobar("La que vence hoy dice que es el ultimo dia",
  (await alumno.locator('[data-grabacion="Tema 2: funciones"]').innerText()).includes("Ultimo dia"));
comprobar("Cada una dice hasta cuando esta disponible", listaAlumno.includes(`Disponible hasta el ${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "UTC" }).format(dia(vencimiento(hoy)))}`));
const boton = alumno.locator(`[data-ver-grabacion="${nueva.id}"]`);
comprobar("El boton abre en otra pestana sin pasar datos",
  (await boton.getAttribute("target")) === "_blank" && (await boton.getAttribute("rel")).includes("noreferrer"));

const vigente = await abrir(alumno, nueva.id);
comprobar("Al abrir una vigente lo lleva al video en Drive", vigente.estado === 302 && vigente.destino === nueva.enlace, `${vigente.estado} ${vigente.destino}`);
await abrir(alumno, nueva.id);
const ultimoDia = await abrir(alumno, tema2.id);
comprobar("El ultimo dia todavia la puede abrir", ultimoDia.destino === tema2.enlace);
const vencida = await abrir(alumno, tema1.id);
comprobar("Una vencida no la abre aunque tenga la direccion",
  vencida.estado === 302 && vencida.destino.includes("aviso=vencida") && !vencida.destino.includes("drive"), vencida.destino);
await alumno.goto(`${BASE}${vencida.destino}`);
comprobar("Y se le explica que ya cumplio su mes", (await limpio(alumno)).includes("ya cumplio su mes"));

// Un alumno dado de baja de la clase ya no la ve.
const baja = await db.alumno.findUnique({ where: { matricula: "2026-0004" } });
await db.alumnoClase.updateMany({ where: { alumnoId: baja.id, claseId: matematicas.id }, data: { estado: "BAJA" } });
const otro = await entrar("2026-0004", "Demo1234");
await otro.goto(`${BASE}/panel/grabaciones`);
const listaOtro = await limpio(otro);
comprobar("Quien no cursa la clase no ve sus grabaciones", !listaOtro.includes("Tema 3: derivadas") && listaOtro.includes("Lectura de poesia"));
comprobar("Ni puede abrirlas con la direccion", !(await abrir(otro, nueva.id)).destino.includes("drive"));
const anonimo = await (await navegador.newContext()).newPage();
const sinSesion = await abrir(anonimo, nueva.id);
comprobar("Sin sesion manda al acceso", sinSesion.estado >= 300 && sinSesion.estado < 400 && /\/acceso/.test(sinSesion.destino) && !sinSesion.destino.includes("drive"), `${sinSesion.estado} ${sinSesion.destino}`);

// ---------------- El docente ve las vencidas y quien las abrio ----------------
await docente.goto(`${BASE}/panel/grabaciones`);
comprobar("El docente sigue viendo la vencida, marcada",
  (await docente.locator('[data-grabacion="Tema 1: conjuntos"]').innerText()).includes("Vencida"));
comprobar("Y la puede abrir", (await abrir(docente, tema1.id)).destino === tema1.enlace);
const filaNueva = docente.locator('[data-grabacion="Tema 3: derivadas"]');
comprobar("Ve cuantos de sus alumnos la abrieron", (await filaNueva.locator("[data-vistas] summary").innerText()).includes("La abrieron 1 de 3"));
await filaNueva.locator("[data-vistas] summary").click();
const fila = filaNueva.locator('[data-vista="2026-0001"]');
comprobar("Ve quien la abrio y cuantas veces",
  (await fila.innerText()).includes("2026-0001") && (await fila.locator("td").nth(1).innerText()).trim() === "2");
comprobar("Abrirla como docente no cuenta como vista de alumno",
  (await db.vistaGrabacion.count({ where: { grabacionId: tema1.id } })) === 0);

// ---------------- Administracion ----------------
const admin = await entrar("admin", "Demo1234");
await admin.goto(`${BASE}/panel/grabaciones`);
const listaAdmin = await limpio(admin);
comprobar("La administracion ve todas, tambien las vencidas",
  ["Tema 1: conjuntos", "Tema 2: funciones", "Tema 3: derivadas", "Lectura de poesia"].every((t) => listaAdmin.includes(t)) && listaAdmin.includes("Vencida"));
comprobar("La administracion consulta, no publica", !listaAdmin.includes("Compartir una grabacion"));
comprobar("Queda en la bitacora", (await db.bitacora.count({ where: { entidad: "Grabacion" } })) === 1);

await navegador.close();
await db.$disconnect();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DE GRABACIONES PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
