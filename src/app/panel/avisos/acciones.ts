"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { claseAccesible } from "@/lib/docencia";
import { archivosDelFormulario, validarArchivos } from "@/lib/archivosEntrega";

export type EstadoAviso = { error?: string; ok?: boolean; mensaje?: string };

/// Publica un aviso para alumnos. La administracion: a todo el colegio o a un
/// grupo. Un docente: solo a una de sus clases.
export async function accionPublicarAviso(_p: EstadoAviso, formData: FormData): Promise<EstadoAviso> {
  const sesion = await requerirRol("ADMIN", "DOCENTE");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const contenido = String(formData.get("contenido") ?? "").trim();
  if (titulo.length < 3) return { error: "Escribe el titulo del aviso." };
  if (contenido.length < 3) return { error: "Escribe el aviso." };
  if (titulo.length > 150 || contenido.length > 3000) return { error: "El aviso es demasiado largo." };

  const adjuntos = await validarArchivos(archivosDelFormulario(formData));
  if (!adjuntos.ok) return { error: adjuntos.error };

  const textoVigencia = String(formData.get("vigenciaHasta") ?? "").trim();
  const vigenciaHasta = /^\d{4}-\d{2}-\d{2}$/.test(textoVigencia) ? new Date(`${textoVigencia}T00:00:00.000Z`) : null;

  const para = String(formData.get("para") ?? "");
  let ambito: "TODOS" | "GRUPO" = "TODOS";
  let referenciaId: number | null = null;
  let claseId: number | null = null;
  let destino = "todo el colegio";

  if (para.startsWith("clase:")) {
    claseId = Number(para.slice(6)) || 0;
    if (!(await claseAccesible(sesion, claseId))) return { error: "Esa clase no es tuya." };
    const clase = await db.clase.findUnique({ where: { id: claseId }, include: { grupo: true, planMateria: { include: { materia: true } } } });
    if (!clase) return { error: "Esa clase ya no existe." };
    ambito = "GRUPO";
    referenciaId = clase.grupoId;
    destino = `${clase.planMateria.materia.nombre} · ${clase.grupo.nombre}`;
  } else if (sesion.rol !== "ADMIN") {
    return { error: "Elige a cual de tus clases va el aviso." };
  } else if (para.startsWith("grupo:")) {
    const grupo = await db.grupo.findUnique({ where: { id: Number(para.slice(6)) || 0 } });
    if (!grupo) return { error: "Ese grupo ya no existe." };
    ambito = "GRUPO";
    referenciaId = grupo.id;
    destino = `grupo ${grupo.nombre}`;
  } else if (para !== "todos") {
    return { error: "Elige para quien es el aviso." };
  }

  const aviso = await db.aviso.create({
    data: {
      titulo,
      contenido,
      ambito,
      referenciaId,
      claseId,
      dirigidoA: ["ALUMNO"],
      publicadoPor: sesion.usuarioId,
      autorNombre: sesion.nombre,
      vigenciaHasta,
      archivos: { create: adjuntos.archivos.map((a) => ({ nombre: a.nombre, mime: a.mime, tamano: a.tamano, datos: a.datos })) },
    },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "Aviso",
    entidadId: aviso.id,
    descripcion: `Aviso "${titulo}" para ${destino}${adjuntos.archivos.length ? ` con ${adjuntos.archivos.length} archivo(s)` : ""}`,
  });
  revalidatePath("/panel", "layout");
  return { ok: true, mensaje: `Aviso publicado para ${destino}.` };
}

export async function accionRetirarAviso(formData: FormData) {
  const sesion = await requerirRol("ADMIN", "DOCENTE");
  const aviso = await db.aviso.findUnique({ where: { id: Number(formData.get("avisoId")) || 0 } });
  if (!aviso) return;
  // El docente solo retira los suyos; la administracion, cualquiera.
  if (sesion.rol !== "ADMIN" && aviso.publicadoPor !== sesion.usuarioId) return;
  await db.aviso.update({ where: { id: aviso.id }, data: { activo: false } });
  revalidatePath("/panel", "layout");
}
