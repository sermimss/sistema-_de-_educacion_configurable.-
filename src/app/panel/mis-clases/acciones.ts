"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { claseAccesible, clasesDelDocente } from "@/lib/docencia";
import { normalizarEnlaceMeet } from "@/lib/reuniones";

export type EstadoEnlace = { error?: string; ok?: boolean; mensaje?: string };

/// El docente pone (o quita) el enlace de Google Meet de una clase, o del
/// mismo enlace para todas sus clases.
export async function accionEnlaceMeet(_p: EstadoEnlace, formData: FormData): Promise<EstadoEnlace> {
  const sesion = await requerirRol("DOCENTE", "ADMIN");
  const resultado = normalizarEnlaceMeet(String(formData.get("enlace") ?? ""));
  if (!resultado.ok) return { error: resultado.error };

  const todas = formData.get("todas") === "1";
  const ids = todas
    ? (await clasesDelDocente(sesion.usuarioId)).map((c) => c.id)
    : [Number(formData.get("claseId")) || 0];
  if (ids.length === 0) return { error: "No tienes clases asignadas." };
  for (const id of ids) {
    if (!(await claseAccesible(sesion, id))) return { error: "Esa clase no es tuya." };
  }

  await db.clase.updateMany({ where: { id: { in: ids } }, data: { enlaceReunion: resultado.enlace } });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "Clase",
    entidadId: ids.length === 1 ? ids[0] : `${ids.length} clases`,
    descripcion: resultado.enlace ? `Enlace de Google Meet: ${resultado.enlace}` : "Enlace de Google Meet quitado",
  });
  revalidatePath("/panel/mis-clases");
  return {
    ok: true,
    mensaje: resultado.enlace
      ? todas
        ? `Enlace puesto en tus ${ids.length} clases. Tus alumnos ya ven el boton para entrar.`
        : "Enlace guardado. Tus alumnos ya ven el boton para entrar."
      : "Enlace quitado.",
  };
}
