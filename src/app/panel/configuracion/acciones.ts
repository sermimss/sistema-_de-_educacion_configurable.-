"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { guardarConfig } from "@/lib/configuracion";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { colorValido, leerImagenSubida } from "@/lib/marca";

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
    const colorPrimario = String(formData.get("colorPrimario") ?? "");
    const colorSecundario = String(formData.get("colorSecundario") ?? "");
    if (!colorValido(colorPrimario) || !colorValido(colorSecundario)) {
      return { error: "Los colores deben tener el formato #RRGGBB." };
    }
    const texto = (clave: string) => String(formData.get(clave) ?? "").trim() || null;
    const datos = {
      nombre: String(formData.get("nombre") ?? "").trim(),
      nombreCorto: texto("nombreCorto"),
      lema: texto("lema"),
      colorPrimario,
      colorSecundario,
      telefono: texto("telefono"),
      email: texto("email"),
      direccion: texto("direccion"),
      ciudad: texto("ciudad"),
      estado: texto("estado"),
      claveCentroTrabajo: texto("claveCentroTrabajo"),
      razonSocial: texto("razonSocial"),
      rfc: texto("rfc")?.toUpperCase() ?? null,
      regimenFiscal: texto("regimenFiscal"),
    };
    if (datos.nombre.length < 3) return { error: "El nombre de la institucion es obligatorio." };

    const imagen = await leerImagenSubida(formData.get("logo"));
    if (imagen && !imagen.ok) return { error: imagen.error };

    const despues = await db.$transaction(async (tx) => {
      let logo: { logoArchivoId: number | null; logoUrl?: null } | Record<string, never> = {};
      if (imagen?.ok) {
        const archivo = await tx.archivoInstitucional.create({
          data: { tipo: "LOGO", nombre: imagen.nombre, mime: imagen.mime, tamano: imagen.datos.length, datos: imagen.datos },
        });
        logo = { logoArchivoId: archivo.id, logoUrl: null };
      } else if (formData.get("quitarLogo") === "on") {
        logo = { logoArchivoId: null, logoUrl: null };
      }
      return tx.institucion.update({ where: { id: 1 }, data: { ...datos, ...logo } });
    });

    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "ACTUALIZAR",
      entidad: "Institucion",
      entidadId: "1",
      datosAntes: antes
        ? { nombre: antes.nombre, colorPrimario: antes.colorPrimario, colorSecundario: antes.colorSecundario, logoArchivoId: antes.logoArchivoId }
        : undefined,
      datosDespues: {
        nombre: despues.nombre,
        colorPrimario: despues.colorPrimario,
        colorSecundario: despues.colorSecundario,
        logoArchivoId: despues.logoArchivoId,
      },
      descripcion: imagen?.ok ? "Logo institucional actualizado" : undefined,
    });
    revalidatePath("/", "layout");
    return { ok: true, mensaje: "Identidad de la institucion actualizada." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar." };
  }
}
