"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { claseAccesible } from "@/lib/docencia";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { fechaHoraAInstante } from "@/lib/fechasDia";
import { validarArchivos } from "@/lib/archivosEntrega";
import { alumnoCursa, puedeEntregar, zonaDelColegio } from "@/lib/tareas";

export type EstadoTarea = { error?: string; ok?: boolean; mensaje?: string };

async function leerDatosTarea(formData: FormData) {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const instrucciones = String(formData.get("instrucciones") ?? "").trim();
  const puntos = Number(formData.get("puntosMaximos"));
  const fechaLimite = fechaHoraAInstante(String(formData.get("fechaLimite") ?? ""), await zonaDelColegio());
  if (titulo.length < 3 || titulo.length > 150) return { error: "Escribe el titulo de la tarea (3 a 150 caracteres)." } as const;
  if (instrucciones.length < 3 || instrucciones.length > 5000) return { error: "Escribe las instrucciones (hasta 5000 caracteres)." } as const;
  if (!Number.isFinite(puntos) || puntos <= 0 || puntos > 1000) return { error: "Los puntos deben ser mayores a 0 y hasta 1000." } as const;
  if (!fechaLimite) return { error: "Indica la fecha y hora limite." } as const;
  return {
    datos: {
      titulo,
      instrucciones,
      puntosMaximos: Math.round(puntos * 100) / 100,
      fechaLimite,
      aceptaTardias: formData.get("aceptaTardias") === "on",
    },
  } as const;
}

export async function accionCrearTarea(_p: EstadoTarea, formData: FormData): Promise<EstadoTarea> {
  const sesion = await requerirRol("DOCENTE");
  const claseId = Number(formData.get("claseId")) || 0;
  if (!(await claseAccesible(sesion, claseId))) return { error: "Elige una de tus clases." };
  const leido = await leerDatosTarea(formData);
  if ("error" in leido) return { error: leido.error };
  if (leido.datos.fechaLimite <= new Date()) return { error: "La fecha limite debe ser posterior a este momento." };
  const tarea = await db.tarea.create({ data: { ...leido.datos, claseId, creadaPor: sesion.usuarioId } });
  await registrarBitacora({ usuarioId: sesion.usuarioId, accion: "CREAR", entidad: "Tarea", entidadId: tarea.id, descripcion: `Tarea "${tarea.titulo}"` });
  revalidatePath("/panel/tareas");
  redirect(`/panel/tareas/${tarea.id}?creada=1`);
}

export async function accionEditarTarea(_p: EstadoTarea, formData: FormData): Promise<EstadoTarea> {
  const sesion = await requerirRol("DOCENTE");
  const tarea = await db.tarea.findUnique({ where: { id: Number(formData.get("tareaId")) || 0 } });
  if (!tarea || !(await claseAccesible(sesion, tarea.claseId))) return { error: "Esa tarea no es tuya." };
  const leido = await leerDatosTarea(formData);
  if ("error" in leido) return { error: leido.error };
  const mayor = await db.entregaTarea.findFirst({
    where: { tareaId: tarea.id, calificacion: { gt: leido.datos.puntosMaximos } },
    select: { id: true },
  });
  if (mayor) return { error: "Ya hay calificaciones mayores a esos puntos." };
  await db.tarea.update({ where: { id: tarea.id }, data: leido.datos });
  await registrarBitacora({ usuarioId: sesion.usuarioId, accion: "ACTUALIZAR", entidad: "Tarea", entidadId: tarea.id, descripcion: `Tarea "${leido.datos.titulo}" editada` });
  revalidatePath(`/panel/tareas/${tarea.id}`);
  return { ok: true, mensaje: "Tarea actualizada." };
}

export async function accionEliminarTarea(formData: FormData) {
  const sesion = await requerirRol("DOCENTE");
  const tarea = await db.tarea.findUnique({ where: { id: Number(formData.get("tareaId")) || 0 }, include: { _count: { select: { entregas: true } } } });
  if (!tarea || !(await claseAccesible(sesion, tarea.claseId)) || tarea._count.entregas > 0) return;
  await db.tarea.delete({ where: { id: tarea.id } });
  await registrarBitacora({ usuarioId: sesion.usuarioId, accion: "ELIMINAR", entidad: "Tarea", entidadId: tarea.id, descripcion: `Tarea "${tarea.titulo}" eliminada (sin entregas)` });
  revalidatePath("/panel/tareas");
  redirect("/panel/tareas?eliminada=1");
}

/// El alumno entrega (o vuelve a entregar: se reemplaza todo).
export async function accionEntregarTarea(_p: EstadoTarea, formData: FormData): Promise<EstadoTarea> {
  const sesion = await requerirRol("ALUMNO");
  const alumno = await alumnoDeSesion(sesion.usuarioId);
  const tarea = await db.tarea.findUnique({ where: { id: Number(formData.get("tareaId")) || 0 } });
  if (!alumno || !tarea || !(await alumnoCursa(alumno.id, tarea.claseId))) return { error: "Esa tarea no es de tus clases." };
  const anterior = await db.entregaTarea.findUnique({ where: { tareaId_alumnoId: { tareaId: tarea.id, alumnoId: alumno.id } } });
  const permiso = puedeEntregar(tarea, anterior);
  if (!permiso.ok) return { error: permiso.motivo };

  const texto = String(formData.get("texto") ?? "").trim();
  if (texto.length > 5000) return { error: "El texto es demasiado largo (hasta 5000 caracteres)." };
  const archivos = await validarArchivos(formData.getAll("archivos").filter((a): a is File => a instanceof File));
  if (!archivos.ok) return { error: archivos.error };
  if (!texto && archivos.archivos.length === 0) return { error: "Sube al menos un archivo o escribe tu respuesta." };

  const entrega = await db.$transaction(async (tx) => {
    if (anterior) await tx.entregaTarea.delete({ where: { id: anterior.id } });
    return tx.entregaTarea.create({
      data: {
        tareaId: tarea.id,
        alumnoId: alumno.id,
        texto: texto || null,
        tarde: permiso.tarde,
        archivos: { create: archivos.archivos.map((a) => ({ nombre: a.nombre, mime: a.mime, tamano: a.tamano, datos: a.datos })) },
      },
    });
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: anterior ? "ACTUALIZAR" : "CREAR",
    entidad: "EntregaTarea",
    entidadId: entrega.id,
    descripcion: `${anterior ? "Volvio a entregar" : "Entrego"} "${tarea.titulo}" (${archivos.archivos.length} archivo(s))${permiso.tarde ? ", tarde" : ""}`,
  });
  revalidatePath(`/panel/tareas/${tarea.id}`);
  return { ok: true, mensaje: permiso.tarde ? "Tarea entregada (fuera de tiempo)." : anterior ? "Entrega reemplazada." : "Tarea entregada." };
}

export async function accionCalificarEntrega(_p: EstadoTarea, formData: FormData): Promise<EstadoTarea> {
  const sesion = await requerirRol("DOCENTE");
  const entrega = await db.entregaTarea.findUnique({ where: { id: Number(formData.get("entregaId")) || 0 }, include: { tarea: true } });
  if (!entrega || !(await claseAccesible(sesion, entrega.tarea.claseId))) return { error: "Esa entrega no es de tus clases." };
  const texto = String(formData.get("calificacion") ?? "").trim();
  const calificacion = Number(texto);
  const maximo = Number(entrega.tarea.puntosMaximos);
  if (!texto || !Number.isFinite(calificacion) || calificacion < 0 || calificacion > maximo) {
    return { error: `La calificacion debe ser de 0 a ${maximo}.` };
  }
  const comentario = String(formData.get("comentario") ?? "").trim().slice(0, 2000) || null;
  await db.entregaTarea.update({
    where: { id: entrega.id },
    data: { calificacion: Math.round(calificacion * 100) / 100, comentario, calificadaEn: new Date(), calificadaPor: sesion.usuarioId },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "EntregaTarea",
    entidadId: entrega.id,
    descripcion: `Califico "${entrega.tarea.titulo}" con ${calificacion}/${maximo}`,
  });
  revalidatePath(`/panel/tareas/${entrega.tareaId}`);
  return { ok: true, mensaje: `Calificada: ${calificacion} de ${maximo}.` };
}
