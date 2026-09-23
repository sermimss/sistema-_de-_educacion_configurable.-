import { chromium } from "playwright";

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const fallos = [];
const sello = Date.now().toString().slice(-6);

function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const limpio = async (p) => (await p.textContent("body")).replace(/\s+/g, " ");

/// Da de alta un alumno y devuelve su matricula generada.
async function altaAlumno(p, nombres, apellido) {
  await p.goto(`${BASE}/panel/alumnos/nuevo`);
  await p.getByLabel(/^Nombre\(s\)\*?$/).fill(nombres);
  await p.getByLabel(/^Apellido paterno\*?$/).fill(apellido);
  await p.getByLabel(/^Plan de estudios\*?$/).selectOption({ index: 1 });
  await p.getByRole("button", { name: "Dar de alta" }).click();
  await p.waitForURL(/\/panel\/alumnos\/\d+/, { timeout: 20000 });
  return (await limpio(p)).match(/\d{4}-\d{4}/)?.[0] ?? "";
}

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await navegador.newPage();
p.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));

// ---------- Acceso ----------
await p.goto(`${BASE}/acceso`);
await p.getByLabel(/^Usuario, matricula o correo\*?$/).fill("admin");
await p.getByLabel(/^Contrasena\*?$/).fill("Demo1234");
await p.getByRole("button", { name: "Entrar" }).click();
await p.waitForURL("**/panel", { timeout: 20000 });
comprobar("Administrador entra al panel", p.url().endsWith("/panel"));
comprobar("El menu ya muestra Control escolar", (await limpio(p)).includes("Control escolar"));

// ---------- Materias ----------
await p.goto(`${BASE}/panel/materias`);
const claveMateria = `QUI-${sello}`;
// La pantalla tiene dos formularios con campo "Clave" (materia y area):
// se acota al de la tarjeta "Nueva materia".
const tarjetaMateria = p.locator("section").filter({ hasText: "Nueva materia" });
await tarjetaMateria.getByLabel(/^Clave\*?$/).fill(claveMateria);
await tarjetaMateria.getByLabel(/^Nombre de la materia\*?$/).fill(`Quimica ${sello}`);
await p.getByRole("button", { name: "Agregar materia" }).click();
await p.waitForTimeout(1500);
comprobar("Crea una materia", (await limpio(p)).includes(`Materia ${claveMateria} creada`));

await tarjetaMateria.getByLabel(/^Clave\*?$/).fill(claveMateria);
await tarjetaMateria.getByLabel(/^Nombre de la materia\*?$/).fill("Repetida");
await p.getByRole("button", { name: "Agregar materia" }).click();
await p.waitForTimeout(1500);
comprobar("Rechaza clave de materia repetida", (await limpio(p)).includes("Ya existe una materia"));

// ---------- Mapa curricular ----------
await p.getByRole("link", { name: /Abrir mapa curricular/ }).first().click();
await p.waitForURL("**/panel/materias/plan/**", { timeout: 15000 });
comprobar("Abre el mapa curricular", (await limpio(p)).includes("Agregar materia al mapa curricular"));

await p.getByLabel(/^Grado\*?$/).selectOption({ index: 2 }); // 3er semestre
await p.getByLabel(/^Materia\*?$/).selectOption({ label: `${claveMateria} · Quimica ${sello}` });
await p.getByLabel(/^Creditos\*?$/).fill("8");
await p.getByLabel(/^Horas por semana\*?$/).fill("4");
await p.getByRole("button", { name: "Agregar al mapa curricular" }).click();
await p.waitForTimeout(1800);
comprobar("Coloca la materia en un grado", (await limpio(p)).includes("agregada al mapa curricular"));

// Prerrequisito invalido: pedir una materia de un grado posterior
const opciones = await p.getByLabel("Para cursar esta materia").locator("option").allTextContents();
const anatomia1 = opciones.find((o) => o.includes("Anatomia I") && !o.includes("Anatomia II"));
const quimica = opciones.find((o) => o.includes(`Quimica ${sello}`));
if (anatomia1 && quimica) {
  await p.getByLabel("Para cursar esta materia").selectOption({ label: anatomia1 });
  await p.getByLabel("Debe tener aprobada").selectOption({ label: quimica });
  await p.getByRole("button", { name: "Agregar prerrequisito" }).click();
  await p.waitForTimeout(1500);
  comprobar("Rechaza prerrequisito de un grado posterior",
    (await limpio(p)).includes("no puede ser prerrequisito"));
} else {
  comprobar("Rechaza prerrequisito de un grado posterior", false, "no se hallaron las opciones");
}

// ---------- Personal ----------
await p.goto(`${BASE}/panel/personal/nuevo`);
await p.getByLabel(/^Nombre\(s\)\*?$/).fill("Carmen");
await p.getByLabel(/^Apellido paterno\*?$/).fill(`Docente${sello}`);
await p.getByLabel(/^Correo\*?$/).fill(`carmen${sello}@demo.mx`);
await p.getByLabel(/^Puesto\*?$/).fill("Docente de Quimica");
await p.getByRole("button", { name: "Dar de alta" }).click();
await p.waitForURL(/\/panel\/personal\/\d+/, { timeout: 20000 });
const vistaDocente = await limpio(p);
comprobar("Crea personal docente", vistaDocente.includes(`Docente${sello} Carmen`));
comprobar("Genera numero de empleado", /DOC-\d{3}/.test(vistaDocente), vistaDocente.match(/DOC-\d{3}/)?.[0]);
comprobar("Crea su cuenta de acceso", vistaDocente.includes("contrasena temporal"));

// ---------- Alumnos ----------
const matricula = await altaAlumno(p, "Renata", `Alumna${sello}`);
const vistaAlumno = await limpio(p);
comprobar("Crea alumno y genera matricula", Boolean(matricula), matricula);
comprobar("Avisa que falta el tutor minimo", vistaAlumno.includes("pide al menos 1 tutor"));

await p.getByLabel(/^Nombre del tutor\*?$/).fill("Patricia Solis");
await p.getByLabel(/^Parentesco\*?$/).fill("Madre");
await p.getByLabel(/^Telefono\*?$/).last().fill("5500000000");
await p.getByRole("button", { name: "Agregar tutor" }).click();
await p.waitForTimeout(1800);
comprobar("Agrega un tutor", (await limpio(p)).includes("Patricia Solis"));

await p.goto(`${BASE}/panel/alumnos?q=${matricula}`);
comprobar("El alumno aparece en la busqueda", (await limpio(p)).includes(matricula));

// Dos alumnos mas, para que el tope de cupo se pueda probar con datos propios.
await altaAlumno(p, "Hugo", `Alumno${sello}B`);
await altaAlumno(p, "Paola", `Alumna${sello}C`);

// ---------- Grupos, clases e inscripcion ----------
await p.goto(`${BASE}/panel/grupos`);
const nombreGrupo = `G-${sello}`;
await p.getByLabel(/^Nombre del grupo\*?$/).fill(nombreGrupo);
await p.getByLabel(/^Cupo maximo\*?$/).fill("2");
await p.getByRole("button", { name: "Crear grupo" }).click();
await p.waitForURL(/\/panel\/grupos\/\d+/, { timeout: 20000 });
comprobar("Crea un grupo", (await limpio(p)).includes(nombreGrupo));

await p.getByLabel(/^Materia\*?$/).selectOption({ index: 1 });
await p.getByLabel(/^Docente\*?$/).selectOption({ index: 1 });
await p.getByRole("button", { name: "Abrir clase" }).click();
await p.waitForTimeout(2000);
comprobar("Abre una clase con docente", (await limpio(p)).includes("asignada al grupo"));

async function inscribirSiguiente() {
  await p.getByLabel(/^Alumno\*?$/).selectOption({ index: 1 });
  await p.getByRole("button", { name: "Inscribir" }).click();
  await p.waitForTimeout(2500);
  return limpio(p);
}

const trasPrimera = await inscribirSiguiente();
comprobar("Inscribe un alumno al grupo", trasPrimera.includes("inscrito en"));

// El grupo se creo con cupo 2: el segundo entra y el tercero debe rebotar.
await inscribirSiguiente();
const trasTercera = await inscribirSiguiente();
comprobar("Respeta el cupo maximo del grupo", trasTercera.includes("esta lleno"));

// No se puede eliminar una clase con alumnos? si puede: solo bloquea con calificaciones.
await p.getByRole("button", { name: "Eliminar" }).first().click();
await p.waitForTimeout(1800);
comprobar("Elimina una clase sin calificaciones",
  !(await limpio(p)).includes("ya tiene calificaciones"));

// ---------- Importacion CSV ----------
await p.goto(`${BASE}/panel/importar`);
await p.getByRole("button", { name: "Materias" }).click();
await p.getByLabel(/^O pega el contenido aqui\*?$/).fill(
  `clave,nombre,area\nFIS-${sello},Fisica ${sello},Ciencias exactas\nBIO-${sello},Biologia ${sello},Ciencias naturales\n,Sin clave,Ciencias`
);
await p.getByRole("button", { name: "Importar" }).click();
await p.waitForTimeout(3000);
const resultado = await limpio(p);
comprobar("Importa las filas correctas", resultado.includes("Importados2"), resultado.slice(resultado.indexOf("Filas leidas"), resultado.indexOf("Filas leidas") + 80));
comprobar("Reporta la fila invalida", resultado.includes("Falta la clave"));

await p.goto(`${BASE}/panel/materias`);
comprobar("Las materias importadas estan en el catalogo",
  (await limpio(p)).includes(`FIS-${sello}`));

// ---------- Cambio obligatorio de contrasena ----------
const contexto = await navegador.newContext();
const pa = await contexto.newPage();
await pa.goto(`${BASE}/acceso`);
await pa.getByLabel(/^Usuario, matricula o correo\*?$/).fill(matricula);
await pa.getByLabel(/^Contrasena\*?$/).fill(matricula);
await pa.getByRole("button", { name: "Entrar" }).click();
await pa.waitForURL("**/panel/cambiar-password", { timeout: 20000 });
comprobar("Obliga a cambiar la contrasena temporal", pa.url().includes("cambiar-password"));

await pa.goto(`${BASE}/panel/alumnos`);
comprobar("No deja navegar sin cambiarla", pa.url().includes("cambiar-password"), pa.url());

await pa.getByLabel(/^Contrasena actual\*?$/).fill(matricula);
await pa.getByLabel(/^Nueva contrasena\*?$/).fill("corta");
await pa.getByLabel(/^Confirma la nueva contrasena\*?$/).fill("corta");
await pa.getByRole("button", { name: "Cambiar contrasena" }).click();
await pa.waitForTimeout(1500);
comprobar("Valida la fortaleza de la nueva contrasena",
  (await limpio(pa)).includes("al menos 8 caracteres"));

await pa.getByLabel(/^Contrasena actual\*?$/).fill(matricula);
await pa.getByLabel(/^Nueva contrasena\*?$/).fill("Renata2026");
await pa.getByLabel(/^Confirma la nueva contrasena\*?$/).fill("Renata2026");
await pa.getByRole("button", { name: "Cambiar contrasena" }).click();
await pa.waitForURL("**/panel", { timeout: 20000 });
comprobar("Cambia la contrasena y entra al portal", pa.url().endsWith("/panel"));

// El alumno no puede tocar control escolar
await pa.goto(`${BASE}/panel/alumnos`);
comprobar("El alumno no accede a Alumnos", !pa.url().includes("/panel/alumnos"), pa.url());
await pa.goto(`${BASE}/panel/grupos`);
comprobar("El alumno no accede a Grupos", !pa.url().includes("/panel/grupos"), pa.url());

await navegador.close();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DE CONTROL ESCOLAR PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
