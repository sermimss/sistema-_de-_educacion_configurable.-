"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { registrarBitacora } from "@/lib/bitacora";
import { recalcularPromedios } from "@/lib/promedios";

export type EstadoBoletas = { error?: string; ok?: boolean; mensaje?: string };

export async function accionRecalcular(
  _previo: EstadoBoletas,
  formData: FormData
): Promise<EstadoBoletas> {
  const sesion = await requerirRol("ADMIN");
  const cicloId = Number(formData.get("cicloId"));
  if (!cicloId) return { error: "Selecciona el ciclo escolar." };

  try {
    const resumen = await recalcularPromedios(cicloId);
    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "ACTUALIZAR",
      entidad: "PromedioCiclo",
      entidadId: cicloId,
      descripcion: `Recalculo: ${resumen.alumnosProcesados} alumnos, ${resumen.materiasCerradas} materias, ${resumen.cuadroHonor} en cuadro de honor`,
    });
    revalidatePath("/panel/boletas");
    return {
      ok: true,
      mensaje: `Listo: ${resumen.alumnosProcesados} alumno(s) con promedio, ${resumen.materiasCerradas} materia(s) calculadas y ${resumen.cuadroHonor} en cuadro de honor.`,
    };
  } catch (error) {
    console.error("[boletas] recalcular:", error);
    return { error: error instanceof Error ? error.message : "No se pudo recalcular." };
  }
}
