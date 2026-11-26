import type { Prisma } from "@prisma/client";
import { db } from "./db";

/// Reglas para eliminar grupos y niveles academicos. Solo se borra lo que no
/// tiene historial: lo que ya tiene alumnos, calificaciones, asistencias,
/// tareas o examenes se conserva (un nivel se puede dar de baja en su lugar).

type Cliente = Prisma.TransactionClient | typeof db;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/// Por que no se puede eliminar el grupo; vacio si se puede.
export async function impedimentosGrupo(grupoId: number, cliente: Cliente = db): Promise<string[]> {
  const deClase = { clase: { grupoId } };
  const [inscritos, concluidos, calificaciones, puntos, extraordinarios, asistencias, tareas, examenes, grabaciones] = await Promise.all([
    cliente.inscripcion.count({ where: { grupoId, estado: "INSCRITO" } }),
    cliente.inscripcion.count({ where: { grupoId, estado: "CONCLUIDO" } }),
    cliente.calificacionPeriodo.count({ where: deClase }),
    cliente.calificacionActividad.count({ where: { actividad: deClase } }),
    cliente.evaluacionExtraordinaria.count({ where: deClase }),
    cliente.sesionAsistencia.count({ where: { OR: [{ grupoId }, deClase] } }),
    cliente.tarea.count({ where: deClase }),
    cliente.examen.count({ where: deClase }),
    cliente.grabacion.count({ where: deClase }),
  ]);
  const motivos: string[] = [];
  if (inscritos) motivos.push(`Tiene ${plural(inscritos, "alumno inscrito", "alumnos inscritos")}: dalos de baja o cambialos de grupo primero.`);
  if (concluidos) motivos.push(`${plural(concluidos, "alumno concluyo", "alumnos concluyeron")} en este grupo (es su historial).`);
  if (calificaciones + puntos + extraordinarios) motivos.push("Tiene calificaciones capturadas.");
  if (asistencias) motivos.push(`Tiene ${plural(asistencias, "pase de lista", "pases de lista")}.`);
  if (tareas) motivos.push(`Tiene ${plural(tareas, "tarea", "tareas")}.`);
  if (examenes) motivos.push(`Tiene ${plural(examenes, "examen", "examenes")}.`);
  if (grabaciones) motivos.push(`Tiene ${plural(grabaciones, "grabacion", "grabaciones")} de clase.`);
  return motivos;
}

/// Borra un grupo sin historial: sus clases (horarios, rubros y listas sin
/// capturas), las inscripciones dadas de baja y apaga los avisos y conceptos
/// de cobro dirigidos solo a el. Llamar dentro de una transaccion.
export async function borrarGrupo(tx: Prisma.TransactionClient, grupoId: number) {
  const clases = (await tx.clase.findMany({ where: { grupoId }, select: { id: true } })).map((c) => c.id);
  const avisos = await tx.aviso.updateMany({
    where: { activo: true, OR: [{ ambito: "GRUPO", referenciaId: grupoId }, { claseId: { in: clases } }] },
    data: { activo: false },
  });
  const conceptos = await tx.conceptoCobro.updateMany({
    where: { activo: true, ambito: "GRUPO", referenciaId: grupoId },
    data: { activo: false },
  });
  await tx.inscripcion.deleteMany({ where: { grupoId } });
  await tx.clase.deleteMany({ where: { grupoId } });
  const grupo = await tx.grupo.delete({ where: { id: grupoId }, include: { ciclo: true } });
  // Cada grupo tiene su propio calendario (ciclo G<id>): se borra con el si
  // nada mas lo usa. Si hay cargos ligados a ese ciclo se conserva.
  let calendario = false;
  if (grupo.ciclo.clave === `G${grupoId}`) {
    const cicloId = grupo.cicloId;
    const [grupos, cargos, promedios, descuentos] = await Promise.all([
      tx.grupo.count({ where: { cicloId } }),
      tx.cargo.count({ where: { cicloId } }),
      tx.promedioCiclo.count({ where: { cicloId } }),
      tx.descuentoAlumno.count({ where: { cicloId } }),
    ]);
    if (grupos + cargos + promedios + descuentos === 0) {
      await tx.cicloEscolar.delete({ where: { id: cicloId } });
      calendario = true;
    }
  }
  return { clases: clases.length, avisos: avisos.count, conceptos: conceptos.count, calendario };
}

export type ImpedimentosNivel = {
  motivos: string[];
  grupos: { id: number; nombre: string; ciclo: string }[];
  /// Tiene historial (alumnos): en lugar de borrarse se puede dar de baja.
  conHistorial: boolean;
};

export async function impedimentosNivel(nivelId: number, cliente: Cliente = db): Promise<ImpedimentosNivel> {
  const delNivel = { plan: { nivelId } };
  const [grupos, alumnos] = await Promise.all([
    cliente.grupo.findMany({
      where: delNivel,
      select: { id: true, nombre: true, ciclo: { select: { nombre: true } } },
      orderBy: { nombre: "asc" },
    }),
    cliente.alumno.count({ where: delNivel }),
  ]);
  const motivos: string[] = [];
  if (grupos.length) motivos.push(`Tiene ${plural(grupos.length, "grupo", "grupos")}: eliminalos primero desde cada grupo.`);
  if (alumnos) motivos.push(`${plural(alumnos, "alumno pertenece", "alumnos pertenecen")} a sus carreras o certificaciones (es su historial).`);
  return {
    motivos,
    grupos: grupos.map((g) => ({ id: g.id, nombre: g.nombre, ciclo: g.ciclo.nombre })),
    conHistorial: alumnos > 0,
  };
}

/// Borra un nivel vacio con sus carreras y certificaciones (periodos y
/// materias del plan) y apaga avisos y conceptos dirigidos solo a ellos.
export async function borrarNivel(tx: Prisma.TransactionClient, nivelId: number) {
  const planes = await tx.planEstudios.findMany({ where: { nivelId }, select: { id: true, grados: { select: { id: true } } } });
  const planIds = planes.map((p) => p.id);
  const gradoIds = planes.flatMap((p) => p.grados.map((g) => g.id));
  const dirigidos = {
    OR: [
      { ambito: "NIVEL" as const, referenciaId: nivelId },
      { ambito: "PLAN" as const, referenciaId: { in: planIds } },
      { ambito: "GRADO" as const, referenciaId: { in: gradoIds } },
    ],
  };
  const avisos = await tx.aviso.updateMany({ where: { activo: true, ...dirigidos }, data: { activo: false } });
  const conceptos = await tx.conceptoCobro.updateMany({ where: { activo: true, ...dirigidos }, data: { activo: false } });
  await tx.planEstudios.deleteMany({ where: { nivelId } });
  await tx.nivelEducativo.delete({ where: { id: nivelId } });
  return { planes: planIds.length, avisos: avisos.count, conceptos: conceptos.count };
}

/// La confirmacion: escribir el nombre (o la clave) tal cual, sin importar
/// mayusculas ni espacios de mas.
export function confirmacionValida(escrito: FormDataEntryValue | null, ...aceptados: string[]): boolean {
  const normal = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();
  const valor = normal(String(escrito ?? ""));
  return valor.length > 0 && aceptados.some((a) => normal(a) === valor);
}
