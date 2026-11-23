"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { claseAccesible } from "@/lib/docencia";
import { obtenerInstitucion } from "@/lib/institucion";
import { formatearDia } from "@/lib/formato";
import { aFechaDia, fechaDeVencimiento, hoyEnZona, normalizarEnlaceGrabacion } from "@/lib/grabaciones";

export type EstadoGrabacion = { error?: string; ok?: boolean; mensaje?: string };

/// El docente comparte la grabacion de una de sus clases. Queda visible para
/// los alumnos hasta el mismo dia del mes siguiente a la clase.
export async function accionPublicarGrabacion(_p: EstadoGrabacion, formData: FormData): Promise<EstadoGrabacion> {
  const sesion = await requerirRol("DOCENTE", "ADMIN");
  const claseId = Number(formData.get("claseId")) || 0;
  if (!(await claseAccesible(sesion, claseId))) return { error: "Esa clase no es tuya." };

  const enlace = normalizarEnlaceGrabacion(String(formData.get("enlace") ?? ""));
  if (!enlace.ok) return { error: enlace.error };

  const titulo = String(formData.get("titulo") ?? "").trim();
  if (titulo.length > 150) return { error: "El titulo es demasiado largo." };

  const institucion = await obtenerInstitucion();
  const hoy = hoyEnZona(institucion?.zonaHoraria ?? "America/Mexico_City");
  const fechaClase = String(formData.get("fechaClase") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaClase) || Number.isNaN(aFechaDia(fechaClase).getTime())) {
    return { error: "Indica la fecha de la clase." };
  }
  if (fechaClase > hoy) return { error: "La fecha de la clase no puede ser posterior a hoy." };
  const vence = fechaDeVencimiento(fechaClase);
  if (vence < hoy) {
    return { error: "Esa clase fue hace mas de un mes: los alumnos ya no podrian ver la grabacion." };
  }

  const clase = await db.clase.findUnique({
    where: { id: claseId },
    include: { grupo: true, planMateria: { include: { materia: true } } },
  });
  if (!clase) return { error: "Esa clase ya no existe." };

  const grabacion = await db.grabacion.create({
    data: {
      claseId,
      fechaClase: aFechaDia(fechaClase),
      disponibleHasta: aFechaDia(vence),
      titulo: titulo || null,
      enlace: enlace.enlace,
      publicadoPor: sesion.usuarioId,
      autorNombre: sesion.nombre,
    },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "Grabacion",
    entidadId: grabacion.id,
    descripcion: `Grabacion de ${clase.planMateria.materia.nombre} · ${clase.grupo.nombre} del ${fechaClase}, disponible hasta ${vence}`,
  });
  revalidatePath("/panel/grabaciones");
  return {
    ok: true,
    mensaje: `Grabacion publicada. Tus alumnos de ${clase.planMateria.materia.nombre} · ${clase.grupo.nombre} la pueden ver hasta el ${formatearDia(aFechaDia(vence))}.`,
  };
}
