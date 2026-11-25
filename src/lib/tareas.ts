import { db } from "./db";
import { obtenerInstitucion } from "./institucion";

/// Tareas que el docente pide a los alumnos de una clase.
///
/// Reglas de entrega:
/// - Antes de la fecha limite el alumno entrega, y puede volver a entregar
///   (se reemplaza todo) mientras no este calificada.
/// - Despues de la fecha limite solo se acepta una primera entrega, y solo si
///   la tarea acepta entregas tardias; queda marcada como tarde.
/// - Ya calificada, no se puede cambiar.

export async function zonaDelColegio(): Promise<string> {
  return (await obtenerInstitucion())?.zonaHoraria ?? "America/Mexico_City";
}

export type EstadoEntrega = "sin-entregar" | "entregada" | "tarde" | "calificada" | "vencida";

export function estadoEntrega(
  tarea: { fechaLimite: Date },
  entrega: { tarde: boolean; calificacion: unknown } | null,
  ahora = new Date()
): EstadoEntrega {
  if (entrega?.calificacion != null) return "calificada";
  if (entrega) return entrega.tarde ? "tarde" : "entregada";
  return ahora > tarea.fechaLimite ? "vencida" : "sin-entregar";
}

/// Si el alumno puede entregar ahora, o por que no.
export function puedeEntregar(
  tarea: { fechaLimite: Date; aceptaTardias: boolean },
  entrega: { calificacion: unknown } | null,
  ahora = new Date()
): { ok: true; tarde: boolean } | { ok: false; motivo: string } {
  if (entrega?.calificacion != null) return { ok: false, motivo: "Tu entrega ya fue calificada." };
  if (ahora <= tarea.fechaLimite) return { ok: true, tarde: false };
  if (entrega) return { ok: false, motivo: "Ya paso la fecha limite: no se puede cambiar tu entrega." };
  if (tarea.aceptaTardias) return { ok: true, tarde: true };
  return { ok: false, motivo: "Ya paso la fecha limite y esta tarea no acepta entregas tardias." };
}

/// El alumno cursa la clase (no dado de baja de ella).
export async function alumnoCursa(alumnoId: number, claseId: number): Promise<boolean> {
  return Boolean(
    await db.alumnoClase.findFirst({ where: { alumnoId, claseId, estado: { not: "BAJA" } }, select: { id: true } })
  );
}

export async function alumnosDeLaClase(claseId: number) {
  const inscritos = await db.alumnoClase.findMany({
    where: { claseId, estado: { not: "BAJA" } },
    include: { alumno: true },
  });
  return inscritos
    .map((i) => i.alumno)
    .sort((a, b) => `${a.apellidoPaterno} ${a.apellidoMaterno ?? ""} ${a.nombres}`.localeCompare(`${b.apellidoPaterno} ${b.apellidoMaterno ?? ""} ${b.nombres}`));
}

/// Ids de las clases que cursa el alumno.
export async function clasesDelAlumno(alumnoId: number): Promise<number[]> {
  return (
    await db.alumnoClase.findMany({ where: { alumnoId, estado: { not: "BAJA" } }, select: { claseId: true } })
  ).map((c) => c.claseId);
}

export const ETIQUETA_ESTADO: Record<EstadoEntrega, { texto: string; tono: "neutro" | "exito" | "alerta" | "peligro" }> = {
  "sin-entregar": { texto: "Por entregar", tono: "alerta" },
  entregada: { texto: "Entregada", tono: "neutro" },
  tarde: { texto: "Entregada tarde", tono: "alerta" },
  calificada: { texto: "Calificada", tono: "exito" },
  vencida: { texto: "No entregada", tono: "peligro" },
};
