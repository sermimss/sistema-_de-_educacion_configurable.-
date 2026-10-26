"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CategoriaDocumento, Prisma } from "@prisma/client";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { leerImagenSubida } from "@/lib/marca";
import { CATALOGO_DOCUMENTOS } from "@/lib/documentos/catalogo";
import { camposDesconocidos, validarCamposExtra } from "@/lib/documentos/campos";
import { camposExtraDe, emitirDocumento } from "@/lib/documentos/datos";

export type EstadoDocumentos = { ok?: boolean; mensaje?: string; error?: string; detalles?: string[] };

const entero = (valor: FormDataEntryValue | null) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export async function accionEmitir(_p: EstadoDocumentos, formData: FormData): Promise<EstadoDocumentos> {
  const sesion = await requerirRol("ADMIN");
  const plantillaId = entero(formData.get("plantillaId"));
  if (!plantillaId) return { error: "Machote no identificado." };

  const plantilla = await db.plantillaDocumento.findUnique({ where: { id: plantillaId } });
  if (!plantilla) return { error: "Ese machote ya no existe." };
  const capturados: Record<string, string> = {};
  for (const campo of camposExtraDe(plantilla.camposExtra)) {
    capturados[campo.clave] = String(formData.get(`extra_${campo.clave}`) ?? "");
  }

  const solicitudId = entero(formData.get("solicitudId"));
  if (solicitudId) {
    const solicitud = await db.solicitudDocumento.findUnique({ where: { id: solicitudId } });
    if (!solicitud || solicitud.estado !== "PENDIENTE") return { error: "Esa solicitud ya fue atendida." };
    if (solicitud.plantillaId !== plantillaId || solicitud.alumnoId !== entero(formData.get("alumnoId"))) {
      return { error: "La solicitud no corresponde a este documento." };
    }
  }

  const resultado = await emitirDocumento({
    plantillaId,
    alumnoId: entero(formData.get("alumnoId")),
    empleadoId: entero(formData.get("empleadoId")),
    capturados,
    cuerpoAjustado: formData.get("ajustar") === "on" ? String(formData.get("cuerpoAjustado") ?? "") : null,
    solicitudId,
    emitidoPor: { id: sesion.usuarioId, nombre: sesion.nombre },
  });
  if (!resultado.ok) return { error: resultado.error };

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "DocumentoEmitido",
    entidadId: resultado.id,
    descripcion: `${plantilla.nombre} ${resultado.folio}`,
  });
  revalidatePath("/panel/documentos", "layout");
  redirect(`/panel/documentos/emitidos/${resultado.id}`);
}

export async function accionCancelarDocumento(_p: EstadoDocumentos, formData: FormData): Promise<EstadoDocumentos> {
  const sesion = await requerirRol("ADMIN");
  const id = entero(formData.get("documentoId"));
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!id) return { error: "Documento no identificado." };
  if (motivo.length < 3) return { error: "Escribe el motivo de la cancelacion." };
  const documento = await db.documentoEmitido.update({
    where: { id },
    data: { cancelado: true, motivoCancelacion: motivo.slice(0, 500) },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CANCELAR",
    entidad: "DocumentoEmitido",
    entidadId: id,
    descripcion: `Documento ${documento.folio} cancelado: ${motivo}`,
  });
  revalidatePath(`/panel/documentos/emitidos/${id}`);
  return { ok: true, mensaje: "Documento cancelado. Queda en el historial marcado como cancelado." };
}

// ---------------------------------------------------------------------------
// Machotes
// ---------------------------------------------------------------------------

const CATEGORIAS: CategoriaDocumento[] = ["ALUMNO", "PERSONAL", "GENERAL"];

export async function accionGuardarMachote(_p: EstadoDocumentos, formData: FormData): Promise<EstadoDocumentos> {
  const sesion = await requerirRol("ADMIN");
  const id = entero(formData.get("id"));
  const existente = id ? await db.plantillaDocumento.findUnique({ where: { id } }) : null;
  if (id && !existente) return { error: "Ese machote ya no existe." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const titulo = String(formData.get("titulo") ?? "").trim();
  const cuerpo = String(formData.get("cuerpo") ?? "").replace(/\r\n/g, "\n").trim();
  const prefijoFolio = String(formData.get("prefijoFolio") ?? "").trim().toUpperCase();
  const categoria = (existente?.categoria ?? String(formData.get("categoria"))) as CategoriaDocumento;
  const firmanteId = entero(formData.get("firmanteId"));

  if (nombre.length < 3) return { error: "El machote necesita un nombre." };
  if (!CATEGORIAS.includes(categoria)) return { error: "Elige para quien es el documento." };
  if (cuerpo.length < 10) return { error: "Escribe el texto del documento." };
  if (cuerpo.length > 20000) return { error: "El texto del documento es demasiado largo." };
  if (!/^[A-Z]{1,6}$/.test(prefijoFolio)) return { error: "El prefijo del folio debe tener de 1 a 6 letras, sin acentos." };

  let campos;
  try {
    campos = validarCamposExtra(JSON.parse(String(formData.get("camposExtra") ?? "[]")));
  } catch {
    return { error: "La lista de datos a capturar no es valida." };
  }
  if (!campos.ok) return { error: campos.error };

  const desconocidos = camposDesconocidos(`${titulo}\n${cuerpo}`, categoria, campos.campos);
  if (desconocidos.length > 0) {
    return {
      error: "El texto usa campos que no existen. Revisa como estan escritos:",
      detalles: desconocidos.map((c) => `{{${c}}}`),
    };
  }
  if (firmanteId && !(await db.firmante.findUnique({ where: { id: firmanteId } }))) {
    return { error: "Ese firmante ya no existe." };
  }

  const datos = {
    nombre: nombre.slice(0, 120),
    titulo: titulo.slice(0, 200),
    descripcion: String(formData.get("descripcion") ?? "").trim().slice(0, 300) || null,
    cuerpo,
    camposExtra: campos.campos as unknown as Prisma.InputJsonValue,
    prefijoFolio,
    firmanteId,
    alumnoPuedeSolicitar: categoria === "ALUMNO" && formData.get("alumnoPuedeSolicitar") === "on",
    activa: formData.get("activa") === "on",
  };

  const guardado = existente
    ? await db.plantillaDocumento.update({ where: { id: existente.id }, data: datos })
    : await db.plantillaDocumento.create({
        data: { ...datos, categoria, clave: `PROPIO_${Date.now().toString(36).toUpperCase()}`, orden: 1000 },
      });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: existente ? "ACTUALIZAR" : "CREAR",
    entidad: "PlantillaDocumento",
    entidadId: guardado.id,
    descripcion: `Machote ${guardado.nombre}`,
  });
  revalidatePath("/panel/documentos", "layout");
  if (!existente) redirect(`/panel/documentos/machotes/${guardado.id}?creado=1`);
  return { ok: true, mensaje: "Machote guardado. Los documentos nuevos ya salen con este texto." };
}

export async function accionRestaurarMachote(_p: EstadoDocumentos, formData: FormData): Promise<EstadoDocumentos> {
  const sesion = await requerirRol("ADMIN");
  const id = entero(formData.get("id"));
  const plantilla = id ? await db.plantillaDocumento.findUnique({ where: { id } }) : null;
  const original = CATALOGO_DOCUMENTOS.find((m) => m.clave === plantilla?.clave);
  if (!plantilla || !original) return { error: "Este machote no tiene un texto original del sistema." };
  await db.plantillaDocumento.update({
    where: { id: plantilla.id },
    data: {
      titulo: original.titulo,
      cuerpo: original.cuerpo,
      camposExtra: original.camposExtra as unknown as Prisma.InputJsonValue,
    },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "PlantillaDocumento",
    entidadId: plantilla.id,
    descripcion: `Machote ${plantilla.nombre} restaurado al texto original`,
  });
  revalidatePath("/panel/documentos", "layout");
  return { ok: true, mensaje: "Se restauro el texto original." };
}

// ---------------------------------------------------------------------------
// Firmantes
// ---------------------------------------------------------------------------

export async function accionGuardarFirmante(_p: EstadoDocumentos, formData: FormData): Promise<EstadoDocumentos> {
  const sesion = await requerirRol("ADMIN");
  const id = entero(formData.get("id"));
  const nombre = String(formData.get("nombre") ?? "").trim();
  const cargo = String(formData.get("cargo") ?? "").trim();
  if (nombre.length < 3) return { error: "Escribe el nombre de quien firma." };
  if (cargo.length < 2) return { error: "Escribe su cargo." };

  const firma = await leerImagenSubida(formData.get("firma"));
  if (firma && !firma.ok) return { error: `Firma: ${firma.error}` };
  const sello = await leerImagenSubida(formData.get("sello"));
  if (sello && !sello.ok) return { error: `Sello: ${sello.error}` };

  const guardado = await db.$transaction(async (tx) => {
    const datos: Prisma.FirmanteUncheckedUpdateInput = {
      nombre: nombre.slice(0, 150),
      cargo: cargo.slice(0, 150),
      activo: id ? formData.get("activo") === "on" : true,
    };
    if (firma?.ok) {
      datos.firmaId = (
        await tx.archivoInstitucional.create({
          data: { tipo: "FIRMA", nombre: firma.nombre, mime: firma.mime, tamano: firma.datos.length, datos: firma.datos },
        })
      ).id;
    } else if (formData.get("quitarFirma") === "on") datos.firmaId = null;
    if (sello?.ok) {
      datos.selloId = (
        await tx.archivoInstitucional.create({
          data: { tipo: "SELLO", nombre: sello.nombre, mime: sello.mime, tamano: sello.datos.length, datos: sello.datos },
        })
      ).id;
    } else if (formData.get("quitarSello") === "on") datos.selloId = null;

    return id
      ? tx.firmante.update({ where: { id }, data: datos })
      : tx.firmante.create({ data: datos as Prisma.FirmanteUncheckedCreateInput });
  });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: id ? "ACTUALIZAR" : "CREAR",
    entidad: "Firmante",
    entidadId: guardado.id,
    descripcion: `Firmante ${guardado.nombre} (${guardado.cargo})`,
  });
  revalidatePath("/panel/documentos", "layout");
  return { ok: true, mensaje: id ? "Firmante actualizado." : "Firmante agregado." };
}

/// Asigna un firmante a todos los machotes que aun no tienen uno.
export async function accionFirmanteParaTodos(_p: EstadoDocumentos, formData: FormData): Promise<EstadoDocumentos> {
  await requerirRol("ADMIN");
  const firmanteId = entero(formData.get("firmanteId"));
  if (!firmanteId) return { error: "Elige un firmante." };
  const { count } = await db.plantillaDocumento.updateMany({
    where: { firmanteId: null },
    data: { firmanteId },
  });
  revalidatePath("/panel/documentos", "layout");
  return { ok: true, mensaje: `Se asigno a ${count} machote(s) que no tenian firmante.` };
}

// ---------------------------------------------------------------------------
// Solicitudes de alumnos
// ---------------------------------------------------------------------------

export async function accionRechazarSolicitud(_p: EstadoDocumentos, formData: FormData): Promise<EstadoDocumentos> {
  const sesion = await requerirRol("ADMIN");
  const id = entero(formData.get("solicitudId"));
  const respuesta = String(formData.get("respuesta") ?? "").trim();
  if (!id) return { error: "Solicitud no identificada." };
  if (respuesta.length < 3) return { error: "Escribe al alumno por que no procede." };
  const { count } = await db.solicitudDocumento.updateMany({
    where: { id, estado: "PENDIENTE" },
    data: { estado: "RECHAZADA", respuesta: respuesta.slice(0, 500), atendidaEn: new Date() },
  });
  if (count === 0) return { error: "Esa solicitud ya fue atendida." };
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "SolicitudDocumento",
    entidadId: id,
    descripcion: `Solicitud rechazada: ${respuesta}`,
  });
  revalidatePath("/panel/documentos", "layout");
  return { ok: true, mensaje: "Solicitud rechazada; el alumno vera el motivo en su portal." };
}
