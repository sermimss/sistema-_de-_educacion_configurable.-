"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { detectarChoques, esHoraValida } from "@/lib/horarios";

export type EstadoHorario = {
  error?: string;
  detalles?: string[];
  ok?: boolean;
  mensaje?: string;
};

export async function agregarHorario(
  _previo: EstadoHorario,
  formData: FormData
): Promise<EstadoHorario> {
  const sesion = await requerirRol("ADMIN");
  const claseId = Number(formData.get("claseId"));
  const diaSemana = Number(formData.get("diaSemana"));
  const moduloId = Number(formData.get("moduloId")) || null;
  const aulaId = Number(formData.get("aulaId")) || null;
  const grupoId = Number(formData.get("grupoId"));

  if (!claseId) return { error: "Selecciona la materia." };
  if (!diaSemana) return { error: "Selecciona el dia." };

  let horaInicio = String(formData.get("horaInicio") ?? "").trim();
  let horaFin = String(formData.get("horaFin") ?? "").trim();

  // Si se eligio un modulo, sus horas mandan sobre las capturadas a mano.
  if (moduloId) {
    const modulo = await db.moduloHorario.findUnique({ where: { id: moduloId } });
    if (!modulo) return { error: "El modulo de horario no existe." };
    if (modulo.esReceso) return { error: "No se pueden programar clases en un receso." };
    horaInicio = modulo.horaInicio;
    horaFin = modulo.horaFin;
  }

  if (!esHoraValida(horaInicio) || !esHoraValida(horaFin)) {
    return { error: "Las horas deben tener el formato HH:MM." };
  }
  if (horaFin <= horaInicio) {
    return { error: "La hora de fin debe ser posterior a la de inicio." };
  }

  const choques = await detectarChoques({ claseId, diaSemana, horaInicio, horaFin, aulaId });
  if (choques.length > 0) {
    return {
      error: "El horario choca con lo ya programado.",
      detalles: choques.map((choque) => choque.mensaje),
    };
  }

  const horario = await db.horarioClase.create({
    data: { claseId, diaSemana, moduloId, horaInicio, horaFin, aulaId },
    include: { clase: { include: { planMateria: { include: { materia: true } } } } },
  });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "HorarioClase",
    entidadId: horario.id,
    descripcion: `${horario.clase.planMateria.materia.nombre} el dia ${diaSemana} de ${horaInicio} a ${horaFin}`,
  });

  revalidatePath("/panel/horarios");
  return { ok: true, mensaje: `Horario agregado (${horaInicio} a ${horaFin}).` };
}

export async function quitarHorario(
  _previo: EstadoHorario,
  formData: FormData
): Promise<EstadoHorario> {
  const sesion = await requerirRol("ADMIN");
  const id = Number(formData.get("horarioId"));

  const horario = await db.horarioClase.findUnique({
    where: { id },
    include: { clase: { include: { planMateria: { include: { materia: true } } } } },
  });
  if (!horario) return { error: "Ese horario ya no existe." };

  await db.horarioClase.delete({ where: { id } });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ELIMINAR",
    entidad: "HorarioClase",
    entidadId: id,
    descripcion: `Se quito ${horario.clase.planMateria.materia.nombre} del dia ${horario.diaSemana}`,
  });

  revalidatePath("/panel/horarios");
  return { ok: true, mensaje: "Horario eliminado." };
}
