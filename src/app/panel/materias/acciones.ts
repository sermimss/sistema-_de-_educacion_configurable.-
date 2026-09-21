"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { esquemaMateria, esquemaPlanMateria } from "@/lib/esquemas";

export type EstadoFormulario = { error?: string; ok?: boolean; mensaje?: string };

function textoONulo(valor: FormDataEntryValue | null): string | null {
  const texto = String(valor ?? "").trim();
  return texto ? texto : null;
}

function enteroONulo(valor: FormDataEntryValue | null): number | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isInteger(numero) && numero >= 0 ? numero : null;
}

export async function crearMateria(
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const sesion = await requerirRol("ADMIN");
  const validacion = esquemaMateria.safeParse({
    clave: formData.get("clave"),
    nombre: formData.get("nombre"),
    descripcion: formData.get("descripcion"),
    areaId: formData.get("areaId") || undefined,
    activa: true,
  });
  if (!validacion.success) {
    return { error: validacion.error.issues.map((i) => i.message).join(" ") };
  }
  const d = validacion.data;

  try {
    const materia = await db.materia.create({
      data: {
        clave: d.clave,
        nombre: d.nombre,
        descripcion: textoONulo(formData.get("descripcion")),
        areaId: enteroONulo(formData.get("areaId")) || null,
      },
    });
    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "CREAR",
      entidad: "Materia",
      entidadId: materia.id,
      descripcion: `Materia ${materia.clave} - ${materia.nombre}`,
    });
    revalidatePath("/panel/materias");
    return { ok: true, mensaje: `Materia ${materia.clave} creada.` };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido.";
    return {
      error: mensaje.includes("Unique constraint")
        ? `Ya existe una materia con la clave ${d.clave}.`
        : `No se pudo crear la materia: ${mensaje}`,
    };
  }
}

export async function cambiarEstadoMateria(formData: FormData) {
  const sesion = await requerirRol("ADMIN");
  const id = Number(formData.get("materiaId"));
  const materia = await db.materia.findUnique({ where: { id } });
  if (!materia) return;

  await db.materia.update({ where: { id }, data: { activa: !materia.activa } });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "Materia",
    entidadId: id,
    datosAntes: { activa: materia.activa },
    datosDespues: { activa: !materia.activa },
  });
  revalidatePath("/panel/materias");
}

export async function crearArea(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  await requerirRol("ADMIN");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (nombre.length < 2) return { error: "Escribe el nombre del area." };
  try {
    await db.area.create({ data: { nombre, clave: textoONulo(formData.get("clave")) } });
    revalidatePath("/panel/materias");
    return { ok: true, mensaje: `Area ${nombre} creada.` };
  } catch {
    return { error: `Ya existe un area llamada ${nombre}.` };
  }
}

/// Coloca una materia dentro de un plan y un grado concretos.
export async function asignarMateriaAPlan(
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const sesion = await requerirRol("ADMIN");
  const validacion = esquemaPlanMateria.safeParse({
    planId: formData.get("planId"),
    gradoId: formData.get("gradoId"),
    materiaId: formData.get("materiaId"),
    obligatoria: formData.get("obligatoria") === "on",
    creditos: formData.get("creditos") || undefined,
    horasSemana: formData.get("horasSemana") || undefined,
  });
  if (!validacion.success) {
    return { error: validacion.error.issues.map((i) => i.message).join(" ") };
  }
  const d = validacion.data;

  const grado = await db.grado.findUnique({ where: { id: d.gradoId } });
  if (!grado || grado.planId !== d.planId) {
    return { error: "El grado seleccionado no pertenece a este plan de estudios." };
  }

  try {
    const planMateria = await db.planMateria.create({
      data: {
        planId: d.planId,
        gradoId: d.gradoId,
        materiaId: d.materiaId,
        obligatoria: formData.get("obligatoria") === "on",
        creditos: enteroONulo(formData.get("creditos")),
        horasSemana: enteroONulo(formData.get("horasSemana")),
      },
      include: { materia: true, grado: true },
    });
    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "CREAR",
      entidad: "PlanMateria",
      entidadId: planMateria.id,
      descripcion: `${planMateria.materia.nombre} agregada a ${planMateria.grado.nombre}`,
    });
    revalidatePath(`/panel/materias/plan/${d.planId}`);
    return { ok: true, mensaje: `${planMateria.materia.nombre} agregada al mapa curricular.` };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido.";
    return {
      error: mensaje.includes("Unique constraint")
        ? "Esa materia ya esta asignada a ese grado en este plan."
        : `No se pudo asignar: ${mensaje}`,
    };
  }
}

export async function quitarMateriaDePlan(
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const sesion = await requerirRol("ADMIN");
  const id = Number(formData.get("planMateriaId"));
  const planId = Number(formData.get("planId"));

  const planMateria = await db.planMateria.findUnique({
    where: { id },
    include: {
      materia: true,
      _count: { select: { clases: true, esPrerrequisitoDe: true } },
    },
  });
  if (!planMateria) return { error: "La materia ya no esta en el plan." };

  // Borrarla arrastraria en cascada las clases y con ellas las calificaciones.
  if (planMateria._count.clases > 0) {
    return {
      error: `No se puede quitar ${planMateria.materia.nombre}: tiene ${planMateria._count.clases} clase(s) abierta(s). Cierra o reasigna esas clases primero.`,
    };
  }
  if (planMateria._count.esPrerrequisitoDe > 0) {
    return {
      error: `No se puede quitar ${planMateria.materia.nombre}: es prerrequisito de otra materia del plan.`,
    };
  }

  await db.planMateria.delete({ where: { id } });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ELIMINAR",
    entidad: "PlanMateria",
    entidadId: id,
    descripcion: `${planMateria.materia.nombre} retirada del plan ${planId}`,
  });
  revalidatePath(`/panel/materias/plan/${planId}`);
  return { ok: true, mensaje: `${planMateria.materia.nombre} retirada del mapa curricular.` };
}

export async function agregarPrerrequisito(
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const sesion = await requerirRol("ADMIN");
  const planMateriaId = Number(formData.get("planMateriaId"));
  const requiereId = Number(formData.get("requierePlanMateriaId"));
  const planId = Number(formData.get("planId"));

  if (!planMateriaId || !requiereId) return { error: "Selecciona la materia requerida." };
  if (planMateriaId === requiereId) {
    return { error: "Una materia no puede ser prerrequisito de si misma." };
  }

  const [materia, requerida] = await Promise.all([
    db.planMateria.findUnique({ where: { id: planMateriaId }, include: { materia: true, grado: true } }),
    db.planMateria.findUnique({ where: { id: requiereId }, include: { materia: true, grado: true } }),
  ]);
  if (!materia || !requerida) return { error: "Alguna de las materias no existe." };
  if (materia.planId !== requerida.planId) {
    return { error: "El prerrequisito debe pertenecer al mismo plan de estudios." };
  }
  if (requerida.grado.numero >= materia.grado.numero) {
    return {
      error: `${requerida.materia.nombre} esta en ${requerida.grado.nombre} y no puede ser prerrequisito de una materia de ${materia.grado.nombre}.`,
    };
  }

  try {
    await db.prerrequisito.create({
      data: { planMateriaId, requierePlanMateriaId: requiereId },
    });
    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "CREAR",
      entidad: "Prerrequisito",
      entidadId: planMateriaId,
      descripcion: `${materia.materia.nombre} requiere ${requerida.materia.nombre}`,
    });
    revalidatePath(`/panel/materias/plan/${planId}`);
    return {
      ok: true,
      mensaje: `${materia.materia.nombre} ahora requiere ${requerida.materia.nombre}.`,
    };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido.";
    return {
      error: mensaje.includes("Unique constraint")
        ? "Ese prerrequisito ya estaba registrado."
        : `No se pudo guardar: ${mensaje}`,
    };
  }
}

export async function quitarPrerrequisito(formData: FormData) {
  const sesion = await requerirRol("ADMIN");
  const id = Number(formData.get("prerrequisitoId"));
  const planId = Number(formData.get("planId"));
  await db.prerrequisito.delete({ where: { id } });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ELIMINAR",
    entidad: "Prerrequisito",
    entidadId: id,
  });
  revalidatePath(`/panel/materias/plan/${planId}`);
}
