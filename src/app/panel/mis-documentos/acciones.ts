"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { alumnoDeSesion, bloqueoPorAdeudo } from "@/lib/alumnoSesion";
import { registrarBitacora } from "@/lib/bitacora";

export type EstadoSolicitud = { ok?: boolean; mensaje?: string; error?: string };

export async function accionSolicitar(_p: EstadoSolicitud, formData: FormData): Promise<EstadoSolicitud> {
  const sesion = await requerirRol("ALUMNO");
  const alumno = await alumnoDeSesion(sesion.usuarioId);
  if (!alumno) return { error: "Tu usuario no esta ligado a un expediente." };

  const bloqueo = await bloqueoPorAdeudo(alumno.id, "CONSTANCIAS");
  if (bloqueo) return { error: bloqueo };

  const plantillaId = Number(formData.get("plantillaId"));
  const plantilla = await db.plantillaDocumento.findUnique({ where: { id: plantillaId || 0 } });
  if (!plantilla || !plantilla.activa || !plantilla.alumnoPuedeSolicitar || plantilla.categoria !== "ALUMNO") {
    return { error: "Ese documento no se puede solicitar." };
  }
  const yaPedida = await db.solicitudDocumento.findFirst({
    where: { alumnoId: alumno.id, plantillaId: plantilla.id, estado: "PENDIENTE" },
  });
  if (yaPedida) return { error: `Ya tienes una solicitud de ${plantilla.nombre} en espera.` };

  const solicitud = await db.solicitudDocumento.create({
    data: {
      alumnoId: alumno.id,
      plantillaId: plantilla.id,
      motivo: String(formData.get("motivo") ?? "").trim().slice(0, 300) || null,
    },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "SolicitudDocumento",
    entidadId: solicitud.id,
    descripcion: `Solicitud de ${plantilla.nombre}`,
  });
  revalidatePath("/panel/mis-documentos");
  return { ok: true, mensaje: `Solicitud enviada. Te avisaremos aqui cuando tu ${plantilla.nombre.toLowerCase()} este lista.` };
}
