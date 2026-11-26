import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

// Menu discreto ⋯ para eliminar clases, materias y areas y para quitar
// materias del mapa curricular: confirmacion escribiendo el nombre, sin
// borrar historial. Requiere una base recien sembrada con los datos de
// demostracion y DATABASE_URL de esa base.

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const db = new PrismaClient();
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const texto = async (p) => (await p.locator("main").innerText()).replace(/\s+/g, " ");

// ---------------- Datos ----------------
const grupoDemo = await db.grupo.findFirst({ where: { nombre: "1A" }, include: { clases: { include: { planMateria: { include: { materia: true } } } } } });
const plan = await db.planEstudios.findUnique({ where: { id: grupoDemo.planId }, include: { grados: { orderBy: { numero: "asc" } } } });
const docente = await db.empleado.findFirst({ where: { esDocente: true } });
const materiaConClase = grupoDemo.clases[0].planMateria.materia;

// Dos materias nuevas en el mapa del 1er semestre y un area con dos materias.
const area = await db.area.create({ data: { nombre: "Tecnologia ZZ" } });
const robotica = await db.materia.create({ data: { clave: "RBZ-1", nombre: "Robotica ZZ", areaId: area.id } });
const dibujo = await db.materia.create({ data: { clave: "DBZ-1", nombre: "Dibujo ZZ", areaId: area.id } });
const pmRobotica = await db.planMateria.create({ data: { planId: plan.id, gradoId: plan.grados[0].id, materiaId: robotica.id } });
const pmDibujo = await db.planMateria.create({ data: { planId: plan.id, gradoId: plan.grados[1].id, materiaId: dibujo.id } });
await db.prerrequisito.create({ data: { planMateriaId: pmDibujo.id, requierePlanMateriaId: pmRobotica.id } });

// Clases nuevas en 1A: una sin nada (Robotica) y otra con una tarea (Dibujo).
const claseRobotica = await db.clase.create({ data: { cicloId: grupoDemo.cicloId, grupoId: grupoDemo.id, planMateriaId: pmRobotica.id, docenteId: docente.id } });
await db.horarioClase.create({ data: { claseId: claseRobotica.id, diaSemana: 6, horaInicio: "12:00", horaFin: "13:00" } });
const avisoClase = await db.aviso.create({ data: { titulo: "Robotica", contenido: "x", claseId: claseRobotica.id, dirigidoA: ["ALUMNO"] } });
const claseDibujo = await db.clase.create({ data: { cicloId: grupoDemo.cicloId, grupoId: grupoDemo.id, planMateriaId: pmDibujo.id, docenteId: docente.id } });
await db.tarea.create({ data: { claseId: claseDibujo.id, titulo: "Boceto", instrucciones: "x", fechaLimite: new Date("2027-02-01") } });

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await navegador.newContext()).newPage();
p.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));
await p.goto(`${BASE}/acceso`);
await p.getByLabel(/^Usuario, matricula o correo\*?$/).fill("admin");
await p.getByLabel(/^Contrasena\*?$/).fill("Demo1234");
await p.getByRole("button", { name: "Entrar" }).click();
await p.waitForURL("**/panel", { timeout: 20000 });

const dialogo = () => p.getByRole("dialog");
async function abrir(contenedor, opcion) {
  await contenedor.getByRole("button", { name: /^Mas opciones/ }).click();
  await p.getByRole("menuitem", { name: opcion }).click();
}

// ---------------- Clases ----------------
await p.goto(`${BASE}/panel/grupos/${grupoDemo.id}`);
comprobar("En el grupo ya no hay botones de eliminar a la vista", !(await texto(p)).includes("Eliminar"));
const filaClase = (clave) => p.locator(`[data-clase="${clave}"]`);

await abrir(filaClase("DBZ-1"), "Eliminar clase");
await dialogo().getByLabel(/para confirmar/).fill("Dibujo ZZ");
await dialogo().getByRole("button", { name: "Eliminar clase" }).click();
await p.waitForTimeout(2000);
comprobar("Una clase con una tarea no se elimina (antes se borraba con todo)",
  (await dialogo().innerText()).includes("ya tiene tareas") && Boolean(await db.clase.findUnique({ where: { id: claseDibujo.id } })));
await dialogo().getByRole("button", { name: "Cancelar" }).click();

await abrir(filaClase("RBZ-1"), "Eliminar clase");
await dialogo().getByLabel(/para confirmar/).fill("otra");
await dialogo().getByRole("button", { name: "Eliminar clase" }).click();
await p.waitForTimeout(1500);
comprobar("Sin escribir la materia no la elimina", (await dialogo().innerText()).includes("escribe el nombre de la materia") && Boolean(await db.clase.findUnique({ where: { id: claseRobotica.id } })));
await dialogo().getByLabel(/para confirmar/).fill("rbz-1");
await dialogo().getByRole("button", { name: "Eliminar clase" }).click();
await p.waitForTimeout(2500);
comprobar("Con la clave de la materia elimina la clase vacia con su horario",
  !(await db.clase.findUnique({ where: { id: claseRobotica.id } })) && (await db.horarioClase.count({ where: { claseId: claseRobotica.id } })) === 0);
comprobar("Y desactiva el aviso de esa clase", (await db.aviso.findUnique({ where: { id: avisoClase.id } })).activo === false);
await db.tarea.deleteMany({ where: { claseId: claseDibujo.id } });
await db.clase.delete({ where: { id: claseDibujo.id } });

// ---------------- Mapa curricular ----------------
await p.goto(`${BASE}/panel/materias/plan/${plan.id}`);
const filaMapa = (clave) => p.locator(`[data-plan-materia="${clave}"]`);
comprobar("En el mapa ya no hay botones Quitar a la vista", !/\bQuitar\b/.test(await texto(p)));
await abrir(filaMapa(materiaConClase.clave), "Quitar del mapa");
await dialogo().getByRole("button", { name: "Quitar" }).click();
await p.waitForTimeout(2000);
comprobar("No quita una materia con clases abiertas", (await dialogo().innerText()).includes("clase(s) abierta(s)"));
await dialogo().getByRole("button", { name: "Cancelar" }).click();

// ---------------- Catalogo de materias ----------------
await p.goto(`${BASE}/panel/materias`);
comprobar("En el catalogo ya no hay Desactivar ni Eliminar a la vista", !/Desactivar|Eliminar/.test(await texto(p)));
const celda = (clave) => p.locator(`[data-materia="${clave}"]`);

await abrir(celda(materiaConClase.clave), "Eliminar materia");
await dialogo().getByLabel(/para confirmar/).fill(materiaConClase.nombre);
await dialogo().getByRole("button", { name: "Eliminar materia" }).click();
await p.waitForTimeout(2500);
comprobar("Una materia que ya se impartio no se elimina y lo explica", (await dialogo().innerText()).includes("ya se abrieron") && Boolean(await db.materia.findUnique({ where: { id: materiaConClase.id } })));
await dialogo().getByRole("button", { name: "Desactivar la materia" }).click();
await p.waitForTimeout(2500);
comprobar("Ofrece desactivarla en su lugar", (await db.materia.findUnique({ where: { id: materiaConClase.id } })).activa === false && (await dialogo().count()) === 0);
await p.goto(`${BASE}/panel/materias`);
await celda(materiaConClase.clave).getByRole("button", { name: "Mas opciones" }).click();
await p.getByRole("menuitem", { name: "Activar" }).click();
await p.waitForTimeout(2500);
comprobar("Activar y desactivar estan en el menu ⋯", (await db.materia.findUnique({ where: { id: materiaConClase.id } })).activa === true);

await p.goto(`${BASE}/panel/materias`);
await abrir(celda("RBZ-1"), "Eliminar materia");
await dialogo().getByLabel(/para confirmar/).fill("Robotica ZZ");
await dialogo().getByRole("button", { name: "Eliminar materia" }).click();
await p.waitForURL(/eliminada=/, { timeout: 15000 }).catch(() => {});
const avisoMateria = await p.locator("[data-materia-eliminada]").innerText().catch(() => "");
comprobar("Una materia que nunca se impartio se elimina y avisa de que mapas se quito", avisoMateria.includes("Robotica ZZ eliminada") && avisoMateria.includes(plan.nombre), avisoMateria);
comprobar("Se quita del mapa curricular con su prerrequisito",
  !(await db.materia.findUnique({ where: { id: robotica.id } })) && !(await db.planMateria.findUnique({ where: { id: pmRobotica.id } })) && (await db.prerrequisito.count({ where: { requierePlanMateriaId: pmRobotica.id } })) === 0);

// Quitar del mapa una materia sin clases
await p.goto(`${BASE}/panel/materias/plan/${plan.id}`);
await abrir(filaMapa("DBZ-1"), "Quitar del mapa");
await dialogo().getByRole("button", { name: "Quitar" }).click();
await p.waitForTimeout(2500);
comprobar("Quita del mapa una materia sin clases desde el menu ⋯", !(await db.planMateria.findUnique({ where: { id: pmDibujo.id } })) && Boolean(await db.materia.findUnique({ where: { id: dibujo.id } })));

// ---------------- Areas ----------------
await p.goto(`${BASE}/panel/materias`);
const chip = p.locator(`[data-area="Tecnologia ZZ"]`);
await abrir(chip, "Eliminar area");
comprobar("Avisa que sus materias no se borran", (await dialogo().innerText()).includes("Sus 1 materia(s) no se borran"));
await dialogo().getByLabel(/para confirmar/).fill("tecnologia zz");
await dialogo().getByRole("button", { name: "Eliminar area" }).click();
await p.waitForURL(/areaEliminada=/, { timeout: 15000 }).catch(() => {});
comprobar("Elimina el area y deja sus materias sin area",
  (await p.locator("[data-area-eliminada]").innerText().catch(() => "")).includes("1 materia(s) quedaron sin area") &&
  !(await db.area.findUnique({ where: { id: area.id } })) && (await db.materia.findUnique({ where: { id: dibujo.id } })).areaId === null);
comprobar("Todo queda en la bitacora", (await db.bitacora.count({ where: { accion: "ELIMINAR", entidad: { in: ["Clase", "Materia", "Area", "PlanMateria"] } } })) >= 4);

await navegador.close();
await db.$disconnect();
if (fallos.length) {
  console.log(`\nFALLARON ${fallos.length}: ${fallos.join(" | ")}`);
  process.exit(1);
}
console.log("\nTODAS LAS PRUEBAS DE ELIMINAR CLASES, MATERIAS Y AREAS PASARON");
