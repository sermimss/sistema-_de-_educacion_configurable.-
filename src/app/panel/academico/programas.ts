"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { TipoPeriodoAcademico, TipoPrograma } from "@prisma/client";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { MODALIDADES, nombrePeriodo, validarCambio } from "@/lib/modalidad";
import { borrarNivel, confirmacionValida, impedimentosNivel } from "@/lib/eliminacionAcademica";

/// Alta y mantenimiento de carreras, certificaciones (programas cortos) y
/// niveles desde Estructura academica.

export type EstadoPrograma = { error?: string; ok?: boolean; mensaje?: string };
export type EstadoEliminarNivel = EstadoPrograma & {
  motivos?: string[];
  grupos?: { id: number; nombre: string; ciclo: string }[];
  /// No se puede borrar: se ofrece darlo de baja.
  ofrecerBaja?: boolean;
};

const CLAVE = /^[A-Z0-9._-]{2,30}$/;
const ERROR_CLAVE = "La clave debe tener de 2 a 30 letras, numeros, punto o guion, sin espacios.";
const TIPOS: TipoPrograma[] = ["CARRERA", "CERTIFICACION"];
const etiquetaTipo = (t: TipoPrograma) => (t === "CARRERA" ? "carrera" : "certificacion");

function texto(formData: FormData, campo: string, max = 150): string {
  return String(formData.get(campo) ?? "").trim().slice(0, max);
}

export async function accionCrearPrograma(_p: EstadoPrograma, formData: FormData): Promise<EstadoPrograma> {
  const sesion = await requerirRol("ADMIN");
  const tipo = String(formData.get("tipo")) as TipoPrograma;
  if (!TIPOS.includes(tipo)) return { error: "Elige si es carrera o certificacion." };
  const nivel = await db.nivelEducativo.findUnique({ where: { id: Number(formData.get("nivelId")) || 0 } });
  if (!nivel || !nivel.activo) return { error: "Elige el nivel." };
  const nombre = texto(formData, "nombre");
  if (nombre.length < 3) return { error: "Escribe el nombre." };
  const clave = texto(formData, "clave", 30).toUpperCase();
  if (!CLAVE.test(clave)) return { error: ERROR_CLAVE };
  if (await db.planEstudios.findUnique({ where: { clave } })) return { error: `Ya existe una carrera o certificacion con la clave ${clave}.` };
  const tituloOtorga = texto(formData, "tituloOtorga") || null;

  const periodos = {
    modalidad: String(formData.get("modalidad")) as TipoPeriodoAcademico,
    periodos: Number(formData.get("periodos")),
    plantilla: texto(formData, "plantilla", 60),
  };
  const problema = validarCambio(periodos);
  if (problema) return { error: problema };

  const plan = await db.$transaction(async (tx) => {
    const creado = await tx.planEstudios.create({
      data: {
        nombre,
        clave,
        tipo,
        tituloOtorga,
        nivelId: nivel.id,
        modalidad: periodos.modalidad,
        duracionPeriodos: periodos.periodos,
        vigenteDesde: new Date(),
        activo: true,
      },
    });
    for (let numero = 1; numero <= periodos.periodos; numero++) {
      await tx.grado.create({
        data: { planId: creado.id, numero, nombre: nombrePeriodo(periodos.plantilla, numero), orden: numero },
      });
    }
    return creado;
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "PlanEstudios",
    entidadId: plan.id,
    descripcion: `Nueva ${etiquetaTipo(tipo)} ${clave} · ${nombre} (${nivel.nombre}, ${periodos.periodos} periodos)`,
  });
  revalidatePath("/panel", "layout");
  redirect(`/panel/academico/plan/${plan.id}?creado=1`);
}

/// Datos generales. La modalidad y los periodos se cambian con "Cambiar
/// modalidad"; el nivel, solo mientras no tenga alumnos ni grupos.
export async function accionEditarPrograma(_p: EstadoPrograma, formData: FormData): Promise<EstadoPrograma> {
  const sesion = await requerirRol("ADMIN");
  const plan = await db.planEstudios.findUnique({
    where: { id: Number(formData.get("planId")) || 0 },
    include: { _count: { select: { alumnos: true, grupos: true } } },
  });
  if (!plan) return { error: "Esa carrera ya no existe." };
  const tipo = String(formData.get("tipo")) as TipoPrograma;
  if (!TIPOS.includes(tipo)) return { error: "Elige si es carrera o certificacion." };
  const nombre = texto(formData, "nombre");
  if (nombre.length < 3) return { error: "Escribe el nombre." };
  const clave = texto(formData, "clave", 30).toUpperCase();
  if (!CLAVE.test(clave)) return { error: ERROR_CLAVE };
  if (clave !== plan.clave && (await db.planEstudios.findUnique({ where: { clave } }))) {
    return { error: `Ya existe una carrera o certificacion con la clave ${clave}.` };
  }
  const tituloOtorga = texto(formData, "tituloOtorga") || null;

  let nivelId = plan.nivelId;
  const nivelPedido = Number(formData.get("nivelId")) || plan.nivelId;
  if (nivelPedido !== plan.nivelId) {
    if (plan._count.alumnos + plan._count.grupos > 0) {
      return { error: "No se puede cambiar el nivel: ya tiene alumnos o grupos." };
    }
    const nivel = await db.nivelEducativo.findUnique({ where: { id: nivelPedido } });
    if (!nivel || !nivel.activo) return { error: "Elige el nivel." };
    nivelId = nivel.id;
  }

  const antes = { nombre: plan.nombre, clave: plan.clave, tipo: plan.tipo, tituloOtorga: plan.tituloOtorga, nivelId: plan.nivelId };
  const despues = { nombre, clave, tipo, tituloOtorga, nivelId };
  if (JSON.stringify(antes) === JSON.stringify(despues)) return { error: "No hay cambios que guardar." };
  await db.planEstudios.update({ where: { id: plan.id }, data: despues });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "PlanEstudios",
    entidadId: plan.id,
    descripcion: `Datos de ${clave} actualizados`,
    datosAntes: antes,
    datosDespues: despues,
  });
  revalidatePath("/panel", "layout");
  return { ok: true, mensaje: "Datos guardados." };
}

/// Dar de baja: deja de ofrecerse a nuevo ingreso; quienes ya la cursan
/// terminan. Nunca se borra. Reactivar la vuelve a ofrecer.
export async function accionOfertaPrograma(formData: FormData) {
  const sesion = await requerirRol("ADMIN");
  const plan = await db.planEstudios.findUnique({ where: { id: Number(formData.get("planId")) || 0 } });
  if (!plan) return;
  const reactivar = formData.get("accion") === "reactivar";
  await db.planEstudios.update({
    where: { id: plan.id },
    data: reactivar ? { vigenteHasta: null, activo: true } : { vigenteHasta: new Date() },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "PlanEstudios",
    entidadId: plan.id,
    descripcion: reactivar ? `${plan.clave} se vuelve a ofrecer a nuevo ingreso` : `${plan.clave} dada de baja: ya no recibe nuevo ingreso`,
  });
  revalidatePath("/panel", "layout");
  redirect(`/panel/academico/plan/${plan.id}?oferta=${reactivar ? "reactivada" : "baja"}`);
}

export async function accionCrearNivel(_p: EstadoPrograma, formData: FormData): Promise<EstadoPrograma> {
  const sesion = await requerirRol("ADMIN");
  const nombre = texto(formData, "nombre", 80);
  if (nombre.length < 3) return { error: "Escribe el nombre del nivel." };
  const clave = texto(formData, "clave", 30).toUpperCase();
  if (!CLAVE.test(clave)) return { error: ERROR_CLAVE };
  const tipoPeriodo = String(formData.get("tipoPeriodo")) as TipoPeriodoAcademico;
  if (!MODALIDADES.some((m) => m.valor === tipoPeriodo)) return { error: "Elige la modalidad." };
  const repetido = await db.nivelEducativo.findFirst({
    where: { OR: [{ clave }, { nombre: { equals: nombre, mode: "insensitive" } }] },
  });
  if (repetido) return { error: `Ya existe el nivel ${repetido.nombre} (${repetido.clave}).` };
  const ultimo = await db.nivelEducativo.aggregate({ _max: { orden: true } });
  const nivel = await db.nivelEducativo.create({
    data: { nombre, clave, tipoPeriodo, orden: (ultimo._max.orden ?? 0) + 1 },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "NivelEducativo",
    entidadId: nivel.id,
    descripcion: `Nuevo nivel ${clave} · ${nombre}`,
  });
  revalidatePath("/panel/academico");
  return { ok: true, mensaje: `Nivel ${nombre} creado. Ya puedes agregarle carreras o certificaciones.` };
}

/// Elimina un nivel que ya no se ofrecera, con sus carreras y certificaciones,
/// solo si esta vacio (sin grupos ni alumnos). Hay que escribir su nombre o
/// clave. Si tiene historial se explica y se ofrece darlo de baja.
export async function accionEliminarNivel(_p: EstadoEliminarNivel, formData: FormData): Promise<EstadoEliminarNivel> {
  const sesion = await requerirRol("ADMIN");
  const nivel = await db.nivelEducativo.findUnique({ where: { id: Number(formData.get("nivelId")) || 0 }, include: { planes: { select: { clave: true } } } });
  if (!nivel) return { error: "Ese nivel ya no existe." };
  if (!confirmacionValida(formData.get("confirmacion"), nivel.nombre, nivel.clave)) {
    return { error: `Para eliminarlo escribe el nombre del nivel (${nivel.nombre}) o su clave (${nivel.clave}).` };
  }
  let borrado: Awaited<ReturnType<typeof borrarNivel>>;
  try {
    const salida = await db.$transaction(async (tx) => {
      const impedimentos = await impedimentosNivel(nivel.id, tx);
      if (impedimentos.motivos.length) return { impedimentos };
      return { borrado: await borrarNivel(tx, nivel.id) };
    });
    if (salida.impedimentos) {
      return {
        error: "Este nivel no se puede eliminar:",
        motivos: salida.impedimentos.motivos,
        grupos: salida.impedimentos.grupos,
        ofrecerBaja: nivel.activo,
      };
    }
    borrado = salida.borrado!;
  } catch (error) {
    console.error("[academico] eliminar nivel:", error);
    return { error: "No se pudo eliminar el nivel; nada se borro." };
  }
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ELIMINAR",
    entidad: "NivelEducativo",
    entidadId: nivel.id,
    descripcion: `Nivel ${nivel.clave} · ${nivel.nombre} eliminado con ${borrado.planes} carrera(s) o certificacion(es)`,
    datosAntes: { nombre: nivel.nombre, clave: nivel.clave, planes: nivel.planes.map((p) => p.clave) },
  });
  revalidatePath("/panel", "layout");
  const params = new URLSearchParams({
    eliminado: nivel.nombre,
    planes: String(borrado.planes),
    avisos: String(borrado.avisos),
    conceptos: String(borrado.conceptos),
  });
  redirect(`/panel/academico?${params}`);
}

/// Dar de baja un nivel con historial: se oculta, no se le agregan carreras y
/// sus carreras dejan de recibir nuevo ingreso. Quienes ya estudian terminan;
/// boletas, pagos y certificados se conservan. Reactivar lo vuelve a mostrar.
export async function accionOfertaNivel(formData: FormData) {
  const sesion = await requerirRol("ADMIN");
  const nivel = await db.nivelEducativo.findUnique({ where: { id: Number(formData.get("nivelId")) || 0 } });
  if (!nivel) return;
  const reactivar = formData.get("accion") === "reactivar";
  const ahora = new Date();
  const cerradas = await db.$transaction(async (tx) => {
    await tx.nivelEducativo.update({ where: { id: nivel.id }, data: { activo: reactivar } });
    if (reactivar) return 0;
    const r = await tx.planEstudios.updateMany({
      where: { nivelId: nivel.id, OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: ahora } }] },
      data: { vigenteHasta: ahora },
    });
    return r.count;
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "NivelEducativo",
    entidadId: nivel.id,
    descripcion: reactivar
      ? `Nivel ${nivel.clave} reactivado`
      : `Nivel ${nivel.clave} dado de baja; ${cerradas} carrera(s) o certificacion(es) sin nuevo ingreso`,
  });
  revalidatePath("/panel", "layout");
  redirect(`/panel/academico?nivel=${reactivar ? "reactivado" : "baja"}`);
}
