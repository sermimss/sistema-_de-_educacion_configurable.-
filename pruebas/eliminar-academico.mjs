import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

// Eliminar niveles academicos y grupos: solo lo que no tiene historial, con
// confirmacion escribiendo el nombre; lo que tiene historial se explica y un
// nivel se puede dar de baja (y volver a ofrecer). Requiere una base recien
// sembrada con los datos de demostracion y DATABASE_URL de esa base.

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const db = new PrismaClient();
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}
const texto = async (p) => (await p.locator("main").innerText()).replace(/\s+/g, " ");

// ---------------- Datos ----------------
const bach = await db.nivelEducativo.findUnique({ where: { clave: "BACH" } });
const grupoDemo = await db.grupo.findFirst({ where: { nombre: "1A" } });
const planDemo = await db.planEstudios.findFirst({ where: { nivelId: bach.id }, include: { grados: true, materias: true } });
const docente = await db.empleado.findFirst({ where: { esDocente: true } });

// Un grupo vacio (con su propio calendario, una clase con horario y una
// inscripcion dada de baja) y otro que solo tiene una tarea.
async function grupoNuevo(nombre, nivelPlan = planDemo) {
  const ciclo = await db.cicloEscolar.create({
    data: { nombre: `${nombre} calendario`, clave: `TMP-${nombre}`, fechaInicio: new Date("2027-01-10"), fechaFin: new Date("2027-06-30"), estado: "ACTIVO", activo: true },
  });
  await db.periodoEvaluacion.create({ data: { cicloId: ciclo.id, numero: 1, nombre: "Parcial 1", fechaInicio: new Date("2027-01-10"), fechaFin: new Date("2027-03-30") } });
  const grupo = await db.grupo.create({ data: { nombre, cicloId: ciclo.id, planId: nivelPlan.id, gradoId: nivelPlan.grados[0].id } });
  await db.cicloEscolar.update({ where: { id: ciclo.id }, data: { clave: `G${grupo.id}` } });
  return grupo;
}
const vacio = await grupoNuevo("ZZ-VACIO");
const claseVacia = await db.clase.create({ data: { cicloId: vacio.cicloId, grupoId: vacio.id, planMateriaId: planDemo.materias[0].id, docenteId: docente.id } });
await db.horarioClase.create({ data: { claseId: claseVacia.id, diaSemana: 1, horaInicio: "08:00", horaFin: "09:00" } });
const alumnoBaja = await db.alumno.findFirst({ where: { matricula: "2026-0004" } });
await db.inscripcion.create({ data: { alumnoId: alumnoBaja.id, cicloId: vacio.cicloId, grupoId: vacio.id, gradoId: vacio.gradoId, estado: "BAJA" } });
const avisoGrupo = await db.aviso.create({ data: { titulo: "Solo ZZ", contenido: "x", ambito: "GRUPO", referenciaId: vacio.id, dirigidoA: ["ALUMNO"] } });

const conTarea = await grupoNuevo("ZZ-TAREA");
const claseTarea = await db.clase.create({ data: { cicloId: conTarea.cicloId, grupoId: conTarea.id, planMateriaId: planDemo.materias[0].id, docenteId: docente.id } });
await db.tarea.create({ data: { claseId: claseTarea.id, titulo: "Ensayo", instrucciones: "x", fechaLimite: new Date("2027-02-01") } });

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await navegador.newContext()).newPage();
p.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));
await p.goto(`${BASE}/acceso`);
await p.getByLabel(/^Usuario, matricula o correo\*?$/).fill("admin");
await p.getByLabel(/^Contrasena\*?$/).fill("Demo1234");
await p.getByRole("button", { name: "Entrar" }).click();
await p.waitForURL("**/panel", { timeout: 20000 });

// ---------------- Discreto: oculto en el menu ⋯ ----------------
await p.goto(`${BASE}/panel/grupos/${grupoDemo.id}`);
comprobar("En el grupo no se ve el boton de eliminar grupo hasta abrir el menu", !(await texto(p)).includes("Eliminar grupo") && (await p.locator("header").getByRole("button", { name: "Mas opciones" }).count()) === 1);
await p.goto(`${BASE}/panel/academico`);
comprobar("En la estructura tampoco", !(await texto(p)).includes("Eliminar") && (await p.locator('[data-nivel="BACH"]').getByRole("button", { name: "Mas opciones" }).count()) === 1);
await p.locator('[data-nivel="BACH"]').getByRole("button", { name: "Mas opciones" }).click();
await p.getByRole("menuitem", { name: "Eliminar nivel" }).click();
await p.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
comprobar("La ventana de confirmacion se cierra con Cancelar sin borrar nada", (await p.getByRole("dialog").count()) === 0 && Boolean(await db.nivelEducativo.findUnique({ where: { id: bach.id } })));

// ---------------- Eliminar grupos ----------------
async function eliminarGrupo(grupo, confirmacion) {
  await p.goto(`${BASE}/panel/grupos/${grupo.id}`);
  await p.locator("header").getByRole("button", { name: "Mas opciones" }).click();
  await p.getByRole("menuitem", { name: "Eliminar grupo" }).click();
  const f = p.locator("[data-eliminar-grupo]");
  await f.getByLabel(/para confirmar/).fill(confirmacion);
  await f.getByRole("button", { name: "Eliminar grupo" }).click();
  await p.waitForTimeout(2500);
}

await eliminarGrupo(grupoDemo, "1A");
const bloqueoDemo = (await p.locator("[data-eliminar-grupo]").innerText()).replace(/\s+/g, " ");
comprobar("Un grupo con alumnos inscritos no se elimina y dice que hacer", bloqueoDemo.includes("ya tiene historial") && bloqueoDemo.includes("4 alumnos inscritos: dalos de baja o cambialos de grupo"), bloqueoDemo);
comprobar("El grupo sigue existiendo", Boolean(await db.grupo.findUnique({ where: { id: grupoDemo.id } })));

await eliminarGrupo(conTarea, "ZZ-TAREA");
comprobar("Un grupo con una tarea tampoco se elimina", (await p.locator("[data-eliminar-grupo]").innerText()).includes("Tiene 1 tarea") && Boolean(await db.grupo.findUnique({ where: { id: conTarea.id } })));

await eliminarGrupo(vacio, "otro nombre");
comprobar("Sin escribir el nombre correcto no elimina", (await p.locator("[data-eliminar-grupo]").innerText()).includes("escribe el nombre del grupo: ZZ-VACIO") && Boolean(await db.grupo.findUnique({ where: { id: vacio.id } })));

await eliminarGrupo(vacio, "  zz-vacio ");
await p.waitForURL(/\/panel\/grupos\?eliminado=/, { timeout: 15000 }).catch(() => {});
comprobar("Escribiendo el nombre elimina el grupo vacio y lo confirma", (await p.locator("[data-grupo-eliminado]").innerText().catch(() => "")).includes("ZZ-VACIO"));
comprobar("Se borran el grupo, sus clases, horarios e inscripciones de baja",
  !(await db.grupo.findUnique({ where: { id: vacio.id } })) && (await db.clase.count({ where: { id: claseVacia.id } })) === 0 &&
  (await db.horarioClase.count({ where: { claseId: claseVacia.id } })) === 0 && (await db.inscripcion.count({ where: { grupoId: vacio.id } })) === 0);
comprobar("Y su calendario propio", (await db.cicloEscolar.count({ where: { id: vacio.cicloId } })) === 0);
comprobar("El alumno dado de baja sigue existiendo", Boolean(await db.alumno.findUnique({ where: { id: alumnoBaja.id } })));
comprobar("El aviso dirigido solo a ese grupo se desactiva", (await db.aviso.findUnique({ where: { id: avisoGrupo.id } })).activo === false);
comprobar("Queda en la bitacora", (await db.bitacora.count({ where: { entidad: "Grupo", entidadId: String(vacio.id), accion: "ELIMINAR" } })) === 1);

// ---------------- Eliminar niveles ----------------
// Un nivel nuevo con una certificacion sin alumnos y un grupo vacio.
await p.goto(`${BASE}/panel/academico`);
const formaNivel = p.locator("[data-nuevo-nivel]");
await formaNivel.getByLabel(/^Nombre del nivel/).fill("Educacion continua");
await formaNivel.getByLabel(/^Clave del nivel/).fill("EC");
await formaNivel.getByRole("button", { name: "Crear nivel" }).click();
await p.getByText(/Nivel Educacion continua creado/).waitFor({ timeout: 15000 });
const ec = await db.nivelEducativo.findUnique({ where: { clave: "EC" } });
const certificacion = await db.planEstudios.create({
  data: { nombre: "Excel avanzado", clave: "EXC-01", tipo: "CERTIFICACION", nivelId: ec.id, duracionPeriodos: 1, grados: { create: [{ numero: 1, nombre: "Modulo unico" }] } },
  include: { grados: true },
});
const grupoEc = await grupoNuevo("EXC-G1", certificacion);
const conceptoEc = await db.conceptoCobro.create({ data: { clave: "EXC-INS", nombre: "Inscripcion Excel", montoBase: 500, ambito: "PLAN", referenciaId: certificacion.id } });

async function eliminarNivel(clave, confirmacion) {
  await p.goto(`${BASE}/panel/academico`);
  await p.locator(`[data-nivel="${clave}"]`).getByRole("button", { name: "Mas opciones" }).click();
  await p.getByRole("menuitem", { name: "Eliminar nivel" }).click();
  const d = p.locator(`[data-eliminar-nivel="${clave}"]`);
  await d.getByLabel(/para confirmar/).fill(confirmacion);
  await d.getByRole("button", { name: "Eliminar nivel" }).click();
  await p.waitForTimeout(2500);
}

await eliminarNivel("EC", "EC");
const bloqueoEc = (await p.locator('[data-eliminar-nivel="EC"]').innerText()).replace(/\s+/g, " ");
comprobar("Un nivel con grupos no se elimina: pide eliminarlos primero", bloqueoEc.includes("Tiene 1 grupo: eliminalos primero"), bloqueoEc);
comprobar("Y enlaza a ese grupo", (await p.locator('[data-eliminar-nivel="EC"] [data-grupos-del-nivel] a').getAttribute("href")) === `/panel/grupos/${grupoEc.id}`);

await eliminarGrupo(grupoEc, "EXC-G1");
await eliminarNivel("EC", "nivel equivocado");
comprobar("Sin el nombre o la clave correctos no elimina", (await p.locator('[data-eliminar-nivel="EC"]').innerText()).includes("escribe el nombre del nivel") && Boolean(await db.nivelEducativo.findUnique({ where: { id: ec.id } })));

await eliminarNivel("EC", "educacion continua");
await p.waitForURL(/\/panel\/academico\?eliminado=/, { timeout: 15000 }).catch(() => {});
const eliminado = await p.locator("[data-nivel-eliminado]").innerText().catch(() => "");
comprobar("Escribiendo el nombre elimina el nivel vacio con su certificacion", eliminado.includes("Educacion continua eliminado junto con 1 carrera(s) o certificacion(es)"), eliminado);
comprobar("En la base ya no estan el nivel, la certificacion ni sus periodos",
  !(await db.nivelEducativo.findUnique({ where: { id: ec.id } })) && !(await db.planEstudios.findUnique({ where: { id: certificacion.id } })) && (await db.grado.count({ where: { planId: certificacion.id } })) === 0);
comprobar("El concepto de cobro solo para esa certificacion se desactiva", (await db.conceptoCobro.findUnique({ where: { id: conceptoEc.id } })).activo === false && eliminado.includes("1 concepto(s) de cobro"));
comprobar("Ya no aparece en la estructura", (await p.locator('[data-nivel="EC"]').count()) === 0);

// ---------------- Nivel con historial: dar de baja ----------------
await eliminarNivel("BACH", "BACH");
const bloqueoBach = (await p.locator('[data-eliminar-nivel="BACH"]').innerText()).replace(/\s+/g, " ");
comprobar("Un nivel con alumnos no se elimina y explica por que", bloqueoBach.includes("alumnos pertenecen a sus carreras") && bloqueoBach.includes("Tiene 2 grupos"), bloqueoBach);
comprobar("Ofrece darlo de baja", (await p.locator("[data-baja-nivel]").count()) === 1);
await p.locator("[data-baja-nivel]").getByRole("button", { name: "Dar de baja el nivel" }).click();
await p.waitForURL(/nivel=baja/, { timeout: 15000 });
const bachDespues = await db.nivelEducativo.findUnique({ where: { id: bach.id } });
const planDespues = await db.planEstudios.findUnique({ where: { id: planDemo.id } });
comprobar("Dar de baja lo oculta y cierra el nuevo ingreso de sus carreras", bachDespues.activo === false && planDespues.vigenteHasta !== null);
comprobar("Aparece en Niveles dados de baja", (await p.locator('[data-nivel-baja="BACH"]').count()) === 1);
comprobar("Nada se borra: alumnos, grupos y la carrera siguen", (await db.alumno.count({ where: { planId: planDemo.id } })) > 0 && Boolean(await db.grupo.findUnique({ where: { id: grupoDemo.id } })));
await p.goto(`${BASE}/panel/academico/nuevo`);
comprobar("No se le pueden agregar carreras nuevas", !(await texto(p)).includes("Bachillerato"));

await p.goto(`${BASE}/panel/academico`);
await p.locator('[data-nivel-baja="BACH"]').getByRole("button", { name: "Volver a ofrecer" }).click();
await p.waitForURL(/nivel=reactivado/, { timeout: 15000 });
comprobar("Se puede volver a ofrecer", (await db.nivelEducativo.findUnique({ where: { id: bach.id } })).activo === true && (await p.locator('[data-nivel="BACH"]').count()) === 1);

await navegador.close();
await db.$disconnect();
if (fallos.length) {
  console.log(`\nFALLARON ${fallos.length}: ${fallos.join(" | ")}`);
  process.exit(1);
}
console.log("\nTODAS LAS PRUEBAS DE ELIMINAR NIVELES Y GRUPOS PASARON");
