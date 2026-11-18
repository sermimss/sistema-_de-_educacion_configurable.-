import { db } from "./db";
import { cicloVigenteDeAlumno } from "./calendarioGrupo";

/// Los avisos vigentes que le tocan a un alumno: los de todo el colegio, los
/// de su grupo y los de las clases que cursa (aunque sean de otro grupo).
export async function avisosDelAlumno(alumnoId: number, limite = 30) {
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  const ciclo = await cicloVigenteDeAlumno(alumnoId);
  const [inscripcion, clases] = await Promise.all([
    ciclo
      ? db.inscripcion.findUnique({ where: { alumnoId_cicloId: { alumnoId, cicloId: ciclo.id } } })
      : null,
    db.alumnoClase.findMany({ where: { alumnoId, estado: { not: "BAJA" } }, select: { claseId: true } }),
  ]);
  const grupoId = inscripcion?.estado === "INSCRITO" ? inscripcion.grupoId : null;
  const misClases = new Set(clases.map((c) => c.claseId));

  const avisos = await db.aviso.findMany({
    where: {
      activo: true,
      dirigidoA: { has: "ALUMNO" },
      OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: hoy } }],
      AND: [
        {
          OR: [
            { ambito: "TODOS" },
            ...(grupoId ? [{ ambito: "GRUPO" as const, referenciaId: grupoId }] : []),
            // Las clases que cursa en otro grupo (alumnos irregulares).
            ...(misClases.size > 0 ? [{ claseId: { in: [...misClases] } }] : []),
          ],
        },
      ],
    },
    orderBy: { fechaPublicacion: "desc" },
    take: limite * 2,
  });
  // Un aviso de una clase solo lo ven quienes la cursan.
  return avisos.filter((a) => !a.claseId || misClases.has(a.claseId)).slice(0, limite);
}
