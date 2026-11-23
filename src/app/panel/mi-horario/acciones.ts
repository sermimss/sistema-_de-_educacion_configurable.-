"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { configBool } from "@/lib/configuracion";
import { empleadoDeSesion } from "@/lib/docencia";
import { obtenerInstitucion } from "@/lib/institucion";
import { hoyEnZona, aFechaDia } from "@/lib/fechasDia";
import { choquesDelCambio, describirCambio, leerCambio } from "@/lib/cambiosHorario";

export type EstadoSolicitudHorario = { error?: string; detalles?: string[]; ok?: boolean; mensaje?: string };

/// El docente pide mover un bloque de su horario. Llega a la administracion
/// para que lo apruebe; si choca con algo, no se envia.
export async function accionSolicitarCambio(_p: EstadoSolicitudHorario, formData: FormData): Promise<EstadoSolicitudHorario> {
  const sesion = await requerirRol("DOCENTE");
  if (!(await configBool("portales.docente_edita_horario", false))) {
    return { error: "El colegio no tiene activados los cambios de horario por parte del docente." };
  }
  const empleado = await empleadoDeSesion(sesion.usuarioId);
  const horario = await db.horarioClase.findUnique({
    where: { id: Number(formData.get("horarioId")) || 0 },
    include: { clase: { include: { ciclo: true, grupo: true, planMateria: { include: { materia: true } } } } },
  });
  if (!empleado || !horario || horario.clase.docenteId !== empleado.id) return { error: "Elige uno de tus bloques." };

  const motivo = String(formData.get("motivo") ?? "").trim();
  if (motivo.length < 5) return { error: "Explica brevemente el motivo del cambio." };
  if (motivo.length > 1000) return { error: "El motivo es demasiado largo." };

  formData.delete("aulaId"); // el aula solo la cambia la administracion
  const institucion = await obtenerInstitucion();
  const hoy = hoyEnZona(institucion?.zonaHoraria ?? "America/Mexico_City");
  const leido = leerCambio(formData, horario, horario.clase.ciclo, hoy);
  if (!leido.ok) return { error: leido.error };
  const c = leido.cambio;

  const repetida = await db.solicitudHorario.findFirst({
    where: {
      horarioId: horario.id,
      estado: "PENDIENTE",
      ...(c.tipo === "UNA_FECHA" ? { tipo: "UNA_FECHA", fechaOriginal: aFechaDia(c.fechaOriginal!) } : { tipo: "PERMANENTE" }),
    },
  });
  if (repetida) return { error: "Ya tienes una solicitud pendiente para ese bloque. Cancelala si quieres pedir otra cosa." };

  const choques = await choquesDelCambio(horario.id, c);
  if (choques.length > 0) return { error: "Ese horario choca con lo ya programado. Elige otro.", detalles: choques };

  const solicitud = await db.solicitudHorario.create({
    data: {
      horarioId: horario.id,
      tipo: c.tipo,
      nuevoDia: c.nuevoDia,
      fechaOriginal: c.fechaOriginal ? aFechaDia(c.fechaOriginal) : null,
      nuevaFecha: c.nuevaFecha ? aFechaDia(c.nuevaFecha) : null,
      horaInicio: c.horaInicio,
      horaFin: c.horaFin,
      motivo,
      solicitadoPor: sesion.usuarioId,
      docenteNombre: sesion.nombre,
    },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "SolicitudHorario",
    entidadId: solicitud.id,
    descripcion: `Pide mover ${horario.clase.planMateria.materia.nombre} · ${horario.clase.grupo.nombre} a ${describirCambio(c)}`,
  });
  revalidatePath("/panel/mi-horario");
  return { ok: true, mensaje: "Solicitud enviada. La administracion la revisara; aqui veras si se aprueba." };
}

export async function accionCancelarSolicitud(formData: FormData) {
  const sesion = await requerirRol("DOCENTE");
  const solicitud = await db.solicitudHorario.findUnique({ where: { id: Number(formData.get("solicitudId")) || 0 } });
  if (!solicitud || solicitud.solicitadoPor !== sesion.usuarioId || solicitud.estado !== "PENDIENTE") return;
  await db.solicitudHorario.update({ where: { id: solicitud.id }, data: { estado: "CANCELADA", resueltaEn: new Date() } });
  await registrarBitacora({ usuarioId: sesion.usuarioId, accion: "CANCELAR", entidad: "SolicitudHorario", entidadId: solicitud.id, descripcion: "El docente cancelo su solicitud de cambio de horario" });
  revalidatePath("/panel/mi-horario");
}
