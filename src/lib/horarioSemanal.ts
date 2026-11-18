import { db } from "./db";
import { nombreCompleto } from "./catalogos";
import { cicloVigenteDeAlumno } from "./calendarioGrupo";
import { clasesDelDocente } from "./docencia";
import type { BloqueHorario } from "@/components/CuadroHorario";

/// Los bloques de la semana de un alumno: las clases del grupo en el que
/// esta hoy, con su docente, aula y enlace de Meet.
export async function bloquesDelAlumno(alumnoId: number): Promise<{ bloques: BloqueHorario[]; grupo: string | null; ciclo: string | null }> {
  const ciclo = await cicloVigenteDeAlumno(alumnoId);
  if (!ciclo) return { bloques: [], grupo: null, ciclo: null };
  const clases = await db.alumnoClase.findMany({
    where: { alumnoId, estado: { not: "BAJA" }, clase: { cicloId: ciclo.id } },
    include: {
      clase: {
        include: {
          planMateria: { include: { materia: true } },
          docente: true,
          aula: true,
          grupo: true,
          horarios: { include: { aula: true }, orderBy: { horaInicio: "asc" } },
        },
      },
    },
  });
  const bloques = clases.flatMap(({ clase }) =>
    clase.horarios.map((h) => ({
      id: h.id,
      diaSemana: h.diaSemana,
      horaInicio: h.horaInicio,
      horaFin: h.horaFin,
      titulo: clase.planMateria.materia.nombre,
      detalle: [nombreCompleto(clase.docente), h.aula?.nombre ?? clase.aula?.nombre].filter(Boolean).join(" · "),
      enlace: clase.enlaceReunion,
    }))
  );
  return { bloques, grupo: clases[0]?.clase.grupo.nombre ?? null, ciclo: ciclo.nombre };
}

/// Los bloques de la semana de un docente: todas sus clases de todos sus grupos.
export async function bloquesDelDocente(usuarioId: number): Promise<BloqueHorario[]> {
  const clases = await clasesDelDocente(usuarioId);
  const horarios = await db.horarioClase.findMany({
    where: { claseId: { in: clases.map((c) => c.id) } },
    include: { aula: true },
    orderBy: { horaInicio: "asc" },
  });
  return horarios.map((h) => {
    const clase = clases.find((c) => c.id === h.claseId)!;
    return {
      id: h.id,
      diaSemana: h.diaSemana,
      horaInicio: h.horaInicio,
      horaFin: h.horaFin,
      titulo: clase.planMateria.materia.nombre,
      detalle: [`${clase.grupo.nombre} · ${clase.grupo.grado.nombre}`, h.aula?.nombre ?? clase.aula?.nombre].filter(Boolean).join(" · "),
      enlace: clase.enlaceReunion,
    };
  });
}
