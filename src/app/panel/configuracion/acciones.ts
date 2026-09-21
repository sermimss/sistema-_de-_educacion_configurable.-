"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { guardarConfig } from "@/lib/configuracion";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";

export type EstadoGuardado = { ok?: boolean; mensaje?: string; error?: string };

export async function guardarCategoria(
  _previo: EstadoGuardado,
  formData: FormData
): Promise<EstadoGuardado> {
  const sesion = await requerirRol("ADMIN");
  const categoria = String(formData.get("__categoria") ?? "");

  try {
    let cambios = 0;
    for (const [clave, valor] of formData.entries()) {
      if (clave.startsWith("__")) continue;
      const nuevo = typeof valor === "string" ? valor : "";
      const actual = await db.configuracion.findUnique({ where: { clave } });
      if (!actual || actual.valor === nuevo) continue;
      await guardarConfig(clave, nuevo, sesion.usuarioId);
      cambios++;
    }
    revalidatePath("/panel/configuracion");
    revalidatePath("/panel");
    return {
      ok: true,
      mensaje: cambios ? `Se guardaron ${cambios} cambio(s) en ${categoria}.` : "Sin cambios.",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar." };
  }
}

export async function guardarIdentidad(
  _previo: EstadoGuardado,
  formData: FormData
): Promise<EstadoGuardado> {
  const sesion = await requerirRol("ADMIN");
  try {
    const antes = await db.institucion.findUnique({ where: { id: 1 } });
    const datos = {
      nombre: String(formData.get("nombre") ?? "").trim(),
      nombreCorto: String(formData.get("nombreCorto") ?? "").trim() || null,
      lema: String(formData.get("lema") ?? "").trim() || null,
      logoUrl: String(formData.get("logoUrl") ?? "").trim() || null,
      colorPrimario: String(formData.get("colorPrimario") ?? "#1d4ed8"),
      colorSecundario: String(formData.get("colorSecundario") ?? "#0f172a"),
      telefono: String(formData.get("telefono") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      direccion: String(formData.get("direccion") ?? "").trim() || null,
      razonSocial: String(formData.get("razonSocial") ?? "").trim() || null,
      rfc: String(formData.get("rfc") ?? "").trim().toUpperCase() || null,
      regimenFiscal: String(formData.get("regimenFiscal") ?? "").trim() || null,
    };
    if (datos.nombre.length < 3) return { error: "El nombre de la institucion es obligatorio." };

    const despues = await db.institucion.update({ where: { id: 1 }, data: datos });
    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "ACTUALIZAR",
      entidad: "Institucion",
      entidadId: "1",
      datosAntes: antes ? { nombre: antes.nombre, colorPrimario: antes.colorPrimario } : undefined,
      datosDespues: { nombre: despues.nombre, colorPrimario: despues.colorPrimario },
    });
    revalidatePath("/panel", "layout");
    return { ok: true, mensaje: "Identidad de la institucion actualizada." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar." };
  }
}
