"use server";

import { revalidatePath } from "next/cache";
import { requerirRol, requerirSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { claseAccesible } from "@/lib/docencia";
import { configBool, configNumero } from "@/lib/configuracion";
import { normalizarConEscala, type EscalaBasica } from "@/lib/calificaciones";

export type EstadoCalificaciones = {
  error?: string;
  detalles?: string[];
  ok?: boolean;
  mensaje?: string;
};

async function escalaDeClase(claseId: number): Promise<EscalaBasica> {
  const clase = await db.clase.findUnique({ where: { id: claseId }, include: { escala: true } });
  const escala =
    clase?.escala ?? (await db.escalaCalificacion.findFirst({ where: { predeterminada: true } }));
  return {
    valorMinimo: Number(escala?.valorMinimo ?? 0),
    valorMaximo: Number(escala?.valorMaximo ?? 100),
    decimales: escala?.decimales ?? 2,
    redondeo: escala?.redondeo ?? "NINGUNO",
    minimaAprobatoria: Number(escala?.minimaAprobatoria ?? 70),
  };
}

/// La captura se bloquea si el periodo esta cerrado y la escuela asi lo pidio.
async function capturaPermitida(periodoId: number): Promise<string | null> {
  const bloquear = await configBool("evaluacion.bloquear_captura_fuera_de_periodo", true);
  if (!bloquear) return null;
  const periodo = await db.periodoEvaluacion.findUnique({ where: { id: periodoId } });
  if (!periodo) return "El periodo no existe.";
  if (!periodo.capturaAbierta) {
    return `La captura del ${periodo.nombre} esta cerrada. Pide a direccion que la abra.`;
  }
  return null;
}

export async function crearRubro(
  _previo: EstadoCalificaciones,
  formData: FormData
): Promise<EstadoCalificaciones> {
  const sesion = await requerirSesion();
  const claseId = Number(formData.get("claseId"));
  const periodoId = Number(formData.get("periodoId"));
  if (!(await claseAccesible(sesion, claseId))) return { error: "Esta clase no es tuya." };

  const docenteDefine = await configBool("evaluacion.docente_define_rubros", true);
  if (!docenteDefine && sesion.rol !== "ADMIN") {
    return { error: "En este colegio los rubros los define direccion." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const peso = Number(formData.get("peso"));
  if (nombre.length < 2) return { error: "Escribe el nombre del rubro." };
  if (!Number.isFinite(peso) || peso <= 0 || peso > 100) {
    return { error: "El peso debe estar entre 1 y 100." };
  }

  const existentes = await db.rubroEvaluacion.findMany({ where: { claseId, periodoId } });
  const suma = existentes.reduce((total, rubro) => total + Number(rubro.peso), 0) + peso;
  const exigeCien = await configBool("evaluacion.suma_pesos_debe_ser_100", true);
  if (exigeCien && suma > 100) {
    return {
      error: `Los pesos sumarian ${suma}%. El colegio exige que sumen 100% y ya llevas ${suma - peso}%.`,
    };
  }

  await db.rubroEvaluacion.create({
    data: { claseId, periodoId, nombre, peso, orden: existentes.length },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "RubroEvaluacion",
    entidadId: claseId,
    descripcion: `Rubro ${nombre} (${peso}%) en la clase ${claseId}`,
  });

  revalidatePath("/panel/calificaciones");
  return { ok: true, mensaje: `Rubro ${nombre} agregado (${suma}% asignado).` };
}

export async function eliminarRubro(
  _previo: EstadoCalificaciones,
  formData: FormData
): Promise<EstadoCalificaciones> {
  const sesion = await requerirSesion();
  const id = Number(formData.get("rubroId"));
  const rubro = await db.rubroEvaluacion.findUnique({
    where: { id },
    include: { _count: { select: { actividades: true } } },
  });
  if (!rubro) return { error: "El rubro ya no existe." };
  if (!(await claseAccesible(sesion, rubro.claseId))) return { error: "Esta clase no es tuya." };
  if (rubro._count.actividades > 0) {
    return {
      error: `No se puede borrar ${rubro.nombre}: tiene ${rubro._count.actividades} actividad(es). Borralas primero.`,
    };
  }

  await db.rubroEvaluacion.delete({ where: { id } });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ELIMINAR",
    entidad: "RubroEvaluacion",
    entidadId: id,
    descripcion: `Rubro ${rubro.nombre} eliminado`,
  });
  revalidatePath("/panel/calificaciones");
  return { ok: true, mensaje: "Rubro eliminado." };
}

export async function crearActividad(
  _previo: EstadoCalificaciones,
  formData: FormData
): Promise<EstadoCalificaciones> {
  const sesion = await requerirSesion();
  const claseId = Number(formData.get("claseId"));
  const periodoId = Number(formData.get("periodoId"));
  if (!(await claseAccesible(sesion, claseId))) return { error: "Esta clase no es tuya." };

  const bloqueo = await capturaPermitida(periodoId);
  if (bloqueo) return { error: bloqueo };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const puntos = Number(formData.get("puntosMaximos"));
  const rubroId = Number(formData.get("rubroId")) || null;
  const fechaEntrega = String(formData.get("fechaEntrega") ?? "").trim();

  if (nombre.length < 2) return { error: "Escribe el nombre de la actividad." };
  if (!Number.isFinite(puntos) || puntos <= 0) return { error: "Los puntos deben ser mayores a 0." };
  if (rubroId) {
    const rubro = await db.rubroEvaluacion.findUnique({ where: { id: rubroId } });
    if (!rubro || rubro.claseId !== claseId) return { error: "Ese rubro no es de esta clase." };
  }

  const actividad = await db.actividad.create({
    data: {
      claseId,
      periodoId,
      rubroId,
      nombre,
      puntosMaximos: puntos,
      descripcion: String(formData.get("descripcion") ?? "").trim() || null,
      fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : null,
    },
  });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "Actividad",
    entidadId: actividad.id,
    descripcion: `Actividad ${nombre} (${puntos} puntos) en la clase ${claseId}`,
  });
  revalidatePath("/panel/calificaciones");
  return { ok: true, mensaje: `Actividad ${nombre} creada.` };
}

export async function eliminarActividad(
  _previo: EstadoCalificaciones,
  formData: FormData
): Promise<EstadoCalificaciones> {
  const sesion = await requerirSesion();
  const id = Number(formData.get("actividadId"));
  const actividad = await db.actividad.findUnique({
    where: { id },
    include: { _count: { select: { calificaciones: true } } },
  });
  if (!actividad) return { error: "La actividad ya no existe." };
  if (!(await claseAccesible(sesion, actividad.claseId))) return { error: "Esta clase no es tuya." };

  await db.actividad.delete({ where: { id } });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ELIMINAR",
    entidad: "Actividad",
    entidadId: id,
    descripcion: `Actividad ${actividad.nombre} eliminada con ${actividad._count.calificaciones} calificacion(es)`,
  });
  revalidatePath("/panel/calificaciones");
  return { ok: true, mensaje: "Actividad eliminada." };
}

/// Guarda los puntos de una actividad para todos los alumnos capturados.
export async function guardarPuntos(
  _previo: EstadoCalificaciones,
  formData: FormData
): Promise<EstadoCalificaciones> {
  const sesion = await requerirSesion();
  const actividadId = Number(formData.get("actividadId"));
  const actividad = await db.actividad.findUnique({ where: { id: actividadId } });
  if (!actividad) return { error: "La actividad no existe." };
  if (!(await claseAccesible(sesion, actividad.claseId))) return { error: "Esta clase no es tuya." };

  const bloqueo = await capturaPermitida(actividad.periodoId);
  if (bloqueo) return { error: bloqueo };

  const maximo = Number(actividad.puntosMaximos);
  const errores: string[] = [];
  let guardados = 0;

  for (const [clave, valor] of formData.entries()) {
    if (!clave.startsWith("puntos_")) continue;
    const alumnoId = Number(clave.slice("puntos_".length));
    if (!alumnoId) continue;
    const texto = String(valor).trim();

    if (texto === "") {
      await db.calificacionActividad.deleteMany({ where: { actividadId, alumnoId } });
      continue;
    }

    const puntos = Number(texto);
    if (!Number.isFinite(puntos) || puntos < 0 || puntos > maximo) {
      errores.push(`Alumno ${alumnoId}: ${texto} no esta entre 0 y ${maximo}.`);
      continue;
    }

    await db.calificacionActividad.upsert({
      where: { actividadId_alumnoId: { actividadId, alumnoId } },
      update: { puntos, capturadoPor: sesion.usuarioId, fechaCaptura: new Date() },
      create: { actividadId, alumnoId, puntos, capturadoPor: sesion.usuarioId },
    });
    guardados++;
  }

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "CalificacionActividad",
    entidadId: actividadId,
    descripcion: `Captura de ${actividad.nombre}: ${guardados} alumno(s)`,
  });

  revalidatePath("/panel/calificaciones");
  return errores.length
    ? { error: "Algunos valores quedaron fuera de rango y no se guardaron.", detalles: errores }
    : { ok: true, mensaje: `Se guardaron ${guardados} calificacion(es).` };
}

/// Calificacion oficial del periodo: es la que la escuela exige entregar,
/// venga del calculo sugerido o del criterio del docente.
export async function guardarCalificacionesPeriodo(
  _previo: EstadoCalificaciones,
  formData: FormData
): Promise<EstadoCalificaciones> {
  const sesion = await requerirSesion();
  const claseId = Number(formData.get("claseId"));
  const periodoId = Number(formData.get("periodoId"));
  if (!(await claseAccesible(sesion, claseId))) return { error: "Esta clase no es tuya." };

  const bloqueo = await capturaPermitida(periodoId);
  if (bloqueo) return { error: bloqueo };

  const escala = await escalaDeClase(claseId);
  const errores: string[] = [];
  let guardadas = 0;

  for (const [clave, valor] of formData.entries()) {
    if (!clave.startsWith("calificacion_")) continue;
    const alumnoId = Number(clave.slice("calificacion_".length));
    if (!alumnoId) continue;
    const texto = String(valor).trim();
    if (texto === "") continue;

    const numero = Number(texto);
    if (!Number.isFinite(numero) || numero < escala.valorMinimo || numero > escala.valorMaximo) {
      errores.push(
        `Alumno ${alumnoId}: ${texto} esta fuera de la escala ${escala.valorMinimo}-${escala.valorMaximo}.`
      );
      continue;
    }

    const anterior = await db.calificacionPeriodo.findUnique({
      where: { claseId_alumnoId_periodoId: { claseId, alumnoId, periodoId } },
    });
    if (anterior?.cerrada) {
      errores.push(`Alumno ${alumnoId}: su calificacion del periodo ya fue cerrada.`);
      continue;
    }

    const calificacion = normalizarConEscala(numero, escala);
    const observaciones = String(formData.get(`observacion_${alumnoId}`) ?? "").trim() || null;

    await db.calificacionPeriodo.upsert({
      where: { claseId_alumnoId_periodoId: { claseId, alumnoId, periodoId } },
      update: {
        calificacion,
        observaciones,
        origen: "MANUAL",
        capturadoPor: sesion.usuarioId,
        fechaCaptura: new Date(),
      },
      create: {
        claseId,
        alumnoId,
        periodoId,
        calificacion,
        observaciones,
        origen: "MANUAL",
        capturadoPor: sesion.usuarioId,
      },
    });

    if (anterior && Number(anterior.calificacion) !== calificacion) {
      await registrarBitacora({
        usuarioId: sesion.usuarioId,
        accion: "ACTUALIZAR",
        entidad: "CalificacionPeriodo",
        entidadId: `${claseId}-${alumnoId}-${periodoId}`,
        datosAntes: { calificacion: Number(anterior.calificacion) },
        datosDespues: { calificacion },
        descripcion: "Cambio de calificacion del periodo",
      });
    }
    guardadas++;
  }

  if (guardadas > 0) {
    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "ACTUALIZAR",
      entidad: "CalificacionPeriodo",
      entidadId: `clase-${claseId}-periodo-${periodoId}`,
      descripcion: `Captura oficial de ${guardadas} calificacion(es)`,
    });
  }

  revalidatePath("/panel/calificaciones");
  return errores.length
    ? { error: "Algunas calificaciones no se guardaron.", detalles: errores }
    : { ok: true, mensaje: `Se guardaron ${guardadas} calificacion(es) del periodo.` };
}

/// Cierra el periodo de la clase: las calificaciones dejan de ser editables.
export async function cerrarPeriodoDeClase(
  _previo: EstadoCalificaciones,
  formData: FormData
): Promise<EstadoCalificaciones> {
  const sesion = await requerirSesion();
  const claseId = Number(formData.get("claseId"));
  const periodoId = Number(formData.get("periodoId"));
  if (!(await claseAccesible(sesion, claseId))) return { error: "Esta clase no es tuya." };

  const inscritos = await db.alumnoClase.count({
    where: { claseId, estado: { not: "BAJA" } },
  });
  const capturadas = await db.calificacionPeriodo.count({
    where: { claseId, periodoId, calificacion: { not: null } },
  });
  if (capturadas < inscritos) {
    return {
      error: `Faltan calificaciones: ${capturadas} de ${inscritos} alumnos. No se puede cerrar el periodo.`,
    };
  }

  await db.calificacionPeriodo.updateMany({
    where: { claseId, periodoId },
    data: { cerrada: true },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "CalificacionPeriodo",
    entidadId: `clase-${claseId}-periodo-${periodoId}`,
    descripcion: `Periodo cerrado con ${capturadas} calificaciones`,
  });

  revalidatePath("/panel/calificaciones");
  return { ok: true, mensaje: "Periodo cerrado." };
}

export async function reabrirPeriodoDeClase(
  _previo: EstadoCalificaciones,
  formData: FormData
): Promise<EstadoCalificaciones> {
  const sesion = await requerirRol("ADMIN");
  const claseId = Number(formData.get("claseId"));
  const periodoId = Number(formData.get("periodoId"));

  await db.calificacionPeriodo.updateMany({
    where: { claseId, periodoId },
    data: { cerrada: false },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "CalificacionPeriodo",
    entidadId: `clase-${claseId}-periodo-${periodoId}`,
    descripcion: "Periodo reabierto por direccion",
  });
  revalidatePath("/panel/calificaciones");
  return { ok: true, mensaje: "Periodo reabierto." };
}

/// Direccion abre o cierra la captura de un periodo para todo el colegio.
export async function alternarCapturaPeriodo(formData: FormData) {
  const sesion = await requerirRol("ADMIN");
  const periodoId = Number(formData.get("periodoId"));
  const periodo = await db.periodoEvaluacion.findUnique({ where: { id: periodoId } });
  if (!periodo) return;

  await db.periodoEvaluacion.update({
    where: { id: periodoId },
    data: { capturaAbierta: !periodo.capturaAbierta },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CONFIGURAR",
    entidad: "PeriodoEvaluacion",
    entidadId: periodoId,
    descripcion: `Captura del ${periodo.nombre} ${periodo.capturaAbierta ? "cerrada" : "abierta"}`,
  });
  revalidatePath("/panel/calificaciones");
}

/// Registra un extraordinario y actualiza el estado de la materia del alumno.
export async function registrarExtraordinario(
  _previo: EstadoCalificaciones,
  formData: FormData
): Promise<EstadoCalificaciones> {
  const sesion = await requerirSesion();
  const claseId = Number(formData.get("claseId"));
  const alumnoId = Number(formData.get("alumnoId"));
  if (!(await claseAccesible(sesion, claseId))) return { error: "Esta clase no es tuya." };

  const permitido = await configBool("evaluacion.permite_extraordinario", true);
  if (!permitido) return { error: "El colegio tiene desactivados los examenes extraordinarios." };

  const escala = await escalaDeClase(claseId);
  const maximoExtra = await configNumero(
    "evaluacion.calificacion_maxima_extraordinario",
    escala.valorMaximo
  );

  const numero = Number(formData.get("calificacion"));
  if (!Number.isFinite(numero) || numero < escala.valorMinimo || numero > escala.valorMaximo) {
    return { error: `La calificacion debe estar entre ${escala.valorMinimo} y ${escala.valorMaximo}.` };
  }
  if (numero > maximoExtra) {
    return { error: `En extraordinario la calificacion maxima es ${maximoExtra}.` };
  }

  const calificacion = normalizarConEscala(numero, escala);
  const tipo = String(formData.get("tipo") ?? "EXTRAORDINARIO") as
    | "EXTRAORDINARIO"
    | "RECUPERACION"
    | "TITULO_SUFICIENCIA";

  await db.$transaction(async (tx) => {
    await tx.evaluacionExtraordinaria.create({
      data: {
        alumnoId,
        claseId,
        tipo,
        calificacion,
        aplicadoPor: sesion.usuarioId,
        observaciones: String(formData.get("observaciones") ?? "").trim() || null,
      },
    });
    await tx.alumnoClase.updateMany({
      where: { claseId, alumnoId },
      data: {
        calificacionFinal: calificacion,
        estado: calificacion >= escala.minimaAprobatoria ? "APROBADA" : "REPROBADA",
      },
    });
  });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "EvaluacionExtraordinaria",
    entidadId: `${claseId}-${alumnoId}`,
    datosDespues: { calificacion, tipo },
    descripcion: `Extraordinario registrado con ${calificacion}`,
  });

  revalidatePath("/panel/calificaciones");
  return { ok: true, mensaje: `Extraordinario registrado con ${calificacion}.` };
}
