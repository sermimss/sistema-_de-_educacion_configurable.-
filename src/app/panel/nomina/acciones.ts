"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MetodoPago } from "@prisma/client";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { configBool } from "@/lib/configuracion";
import { aNumero, centavos } from "@/lib/finanzas";
import { calcularNominaDelPeriodo, sueldoDeRecibo } from "@/lib/nomina";

export type EstadoNomina = {
  error?: string;
  detalles?: string[];
  ok?: boolean;
  mensaje?: string;
};

function texto(formData: FormData, clave: string): string {
  return String(formData.get(clave) ?? "").trim();
}
function numero(formData: FormData, clave: string): number | null {
  const valor = texto(formData, clave);
  if (!valor) return null;
  const parseado = Number(valor);
  return Number.isFinite(parseado) ? parseado : null;
}
function entero(formData: FormData, clave: string): number | null {
  const valor = numero(formData, clave);
  return valor != null && Number.isInteger(valor) ? valor : null;
}
function fecha(formData: FormData, clave: string): Date | null {
  const valor = texto(formData, clave);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  return new Date(`${valor}T00:00:00.000Z`);
}

async function exigirNominaActiva(): Promise<string | null> {
  const activa = await configBool("nomina.activa", true);
  return activa ? null : "El modulo de nomina esta desactivado en Configuracion.";
}

const TIPOS = ["PERCEPCION", "DEDUCCION", "OTRO_PAGO"] as const;

/// Catalogo de conceptos de nomina, definido por el colegio.
export async function guardarConceptoNomina(
  _previo: EstadoNomina,
  formData: FormData
): Promise<EstadoNomina> {
  const sesion = await requerirRol("ADMIN");
  const bloqueo = await exigirNominaActiva();
  if (bloqueo) return { error: bloqueo };

  const id = entero(formData, "id");
  const clave = texto(formData, "clave").toUpperCase();
  const nombre = texto(formData, "nombre");
  const tipo = texto(formData, "tipo") as (typeof TIPOS)[number];
  const tipoCalculo = texto(formData, "tipoCalculo") as "FIJO" | "PORCENTAJE";
  const valor = numero(formData, "valor");

  if (!clave) return { error: "La clave del concepto es obligatoria." };
  if (nombre.length < 2) return { error: "Escribe el nombre del concepto." };
  if (!TIPOS.includes(tipo)) return { error: "Tipo de concepto no reconocido." };
  if (valor == null || valor <= 0) return { error: "El valor debe ser mayor a 0." };
  if (tipoCalculo === "PORCENTAJE" && valor > 100) {
    return { error: "Un concepto en porcentaje no puede pasar de 100." };
  }

  const datos = {
    clave,
    nombre,
    tipo,
    tipoCalculo,
    valor,
    gravable: formData.get("gravable") === "on",
    claveSat: texto(formData, "claveSat") || null,
    activo: formData.get("activo") === "on",
  };

  try {
    if (id) {
      await db.conceptoNomina.update({ where: { id }, data: datos });
    } else {
      const total = await db.conceptoNomina.count();
      await db.conceptoNomina.create({ data: { ...datos, orden: total } });
    }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido.";
    return {
      error: mensaje.includes("Unique constraint")
        ? `Ya existe un concepto de nomina con la clave ${clave}.`
        : `No se pudo guardar: ${mensaje}`,
    };
  }

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: id ? "ACTUALIZAR" : "CREAR",
    entidad: "ConceptoNomina",
    entidadId: id ?? undefined,
    descripcion: `${nombre}: ${valor}${tipoCalculo === "PORCENTAJE" ? "%" : ""} (${tipo})`,
  });

  revalidatePath("/panel/nomina/conceptos");
  return { ok: true, mensaje: id ? `Concepto ${nombre} actualizado.` : `Concepto ${nombre} creado.` };
}

export async function alternarConceptoNomina(formData: FormData) {
  const sesion = await requerirRol("ADMIN");
  const id = Number(formData.get("conceptoId"));
  const concepto = await db.conceptoNomina.findUnique({ where: { id } });
  if (!concepto) return;

  await db.conceptoNomina.update({ where: { id }, data: { activo: !concepto.activo } });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "ConceptoNomina",
    entidadId: id,
    datosAntes: { activo: concepto.activo },
    datosDespues: { activo: !concepto.activo },
  });
  revalidatePath("/panel/nomina/conceptos");
}

export async function eliminarConceptoNomina(
  _previo: EstadoNomina,
  formData: FormData
): Promise<EstadoNomina> {
  const sesion = await requerirRol("ADMIN");
  const id = Number(formData.get("conceptoId"));
  const concepto = await db.conceptoNomina.findUnique({
    where: { id },
    include: { _count: { select: { detalles: true } } },
  });
  if (!concepto) return { error: "El concepto ya no existe." };
  if (concepto._count.detalles > 0) {
    return {
      error: `No se puede borrar ${concepto.nombre}: aparece en ${concepto._count.detalles} recibo(s). Desactivalo para que deje de usarse.`,
    };
  }

  await db.conceptoNomina.delete({ where: { id } });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ELIMINAR",
    entidad: "ConceptoNomina",
    entidadId: id,
    descripcion: `Concepto ${concepto.nombre} eliminado`,
  });
  revalidatePath("/panel/nomina/conceptos");
  return { ok: true, mensaje: "Concepto eliminado." };
}

/// Periodo de nomina: el colegio decide sus fechas y cuando se paga.
export async function crearPeriodoNomina(
  _previo: EstadoNomina,
  formData: FormData
): Promise<EstadoNomina> {
  const sesion = await requerirRol("ADMIN");
  const bloqueo = await exigirNominaActiva();
  if (bloqueo) return { error: bloqueo };

  const nombre = texto(formData, "nombre");
  const fechaInicio = fecha(formData, "fechaInicio");
  const fechaFin = fecha(formData, "fechaFin");
  const fechaPago = fecha(formData, "fechaPago");

  if (nombre.length < 3) return { error: "Escribe el nombre del periodo." };
  if (!fechaInicio || !fechaFin || !fechaPago) return { error: "Captura las tres fechas." };
  if (fechaFin < fechaInicio) return { error: "La fecha de fin no puede ser anterior a la de inicio." };
  if (fechaPago < fechaInicio) return { error: "La fecha de pago no puede ser anterior al periodo." };

  const traslape = await db.periodoNomina.findFirst({
    where: { fechaInicio: { lte: fechaFin }, fechaFin: { gte: fechaInicio } },
  });
  if (traslape) {
    return { error: `Ese rango se encima con el periodo "${traslape.nombre}".` };
  }

  let idCreado: number;
  try {
    const periodo = await db.periodoNomina.create({
      data: { nombre, fechaInicio, fechaFin, fechaPago, estado: "ABIERTO" },
    });
    idCreado = periodo.id;
    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "CREAR",
      entidad: "PeriodoNomina",
      entidadId: periodo.id,
      descripcion: `Periodo ${nombre}`,
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido.";
    return { error: `No se pudo crear el periodo: ${mensaje}` };
  }

  revalidatePath("/panel/nomina");
  redirect(`/panel/nomina/${idCreado}`);
}

export async function accionCalcularNomina(
  _previo: EstadoNomina,
  formData: FormData
): Promise<EstadoNomina> {
  const sesion = await requerirRol("ADMIN");
  const periodoId = entero(formData, "periodoId");
  if (!periodoId) return { error: "Periodo no identificado." };

  const periodo = await db.periodoNomina.findUnique({ where: { id: periodoId } });
  if (!periodo) return { error: "El periodo no existe." };
  if (periodo.estado === "PAGADO" || periodo.estado === "CANCELADO") {
    return { error: `El periodo esta ${periodo.estado.toLowerCase()} y ya no se recalcula.` };
  }

  const empleados = await db.empleado.count({ where: { estado: "ACTIVO" } });
  if (empleados === 0) return { error: "No hay personal activo al que calcularle nomina." };

  const resumen = await calcularNominaDelPeriodo(periodoId);
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "PeriodoNomina",
    entidadId: periodoId,
    descripcion: `Calculo: ${resumen.creados} nuevos, ${resumen.actualizados} recalculados, ${resumen.omitidos} sin tocar, neto ${resumen.totalNeto}`,
  });

  revalidatePath(`/panel/nomina/${periodoId}`);
  return {
    ok: true,
    mensaje: `Listo: ${resumen.creados} recibo(s) nuevos, ${resumen.actualizados} recalculado(s) y ${resumen.omitidos} sin tocar por estar autorizados. Neto del periodo: ${resumen.totalNeto}.`,
  };
}

/// Linea capturada a mano en un recibo: bono, prestamo, horas extra.
export async function agregarLineaRecibo(
  _previo: EstadoNomina,
  formData: FormData
): Promise<EstadoNomina> {
  const sesion = await requerirRol("ADMIN");
  const reciboId = entero(formData, "reciboId");
  const conceptoId = entero(formData, "conceptoId");
  const importe = numero(formData, "importe");
  const cantidad = numero(formData, "cantidad");

  if (!reciboId || !conceptoId) return { error: "Selecciona el concepto." };
  if (importe == null || importe <= 0) return { error: "El importe debe ser mayor a 0." };

  const [recibo, concepto] = await Promise.all([
    db.reciboNomina.findUnique({
      where: { id: reciboId },
      include: { detalles: { include: { concepto: true } } },
    }),
    db.conceptoNomina.findUnique({ where: { id: conceptoId } }),
  ]);
  if (!recibo) return { error: "El recibo no existe." };
  if (!concepto) return { error: "El concepto no existe." };
  if (recibo.estado !== "BORRADOR") {
    return { error: "Solo se puede modificar un recibo en borrador." };
  }

  await db.$transaction(async (tx) => {
    await tx.detalleReciboNomina.create({
      data: { reciboId, conceptoId, cantidad, importe: centavos(importe), manual: true },
    });

    const detalles = await tx.detalleReciboNomina.findMany({
      where: { reciboId },
      include: { concepto: true },
    });

    // El sueldo del periodo no se guarda como linea: es lo que queda de las
    // percepciones al restar las lineas de percepcion que ya tenia el recibo.
    // Las deducciones no se restan aqui porque no forman parte de ese total.
    const sueldoDelPeriodo = sueldoDeRecibo(
      aNumero(recibo.totalPercepciones),
      recibo.detalles.map((detalle) => ({
        tipo: detalle.concepto.tipo,
        importe: aNumero(detalle.importe),
      }))
    );

    const percepciones = detalles
      .filter((d) => d.concepto.tipo !== "DEDUCCION")
      .reduce((suma, d) => suma + aNumero(d.importe), 0);
    const deducciones = detalles
      .filter((d) => d.concepto.tipo === "DEDUCCION")
      .reduce((suma, d) => suma + aNumero(d.importe), 0);

    const totalPercepciones = centavos(sueldoDelPeriodo + percepciones);
    await tx.reciboNomina.update({
      where: { id: reciboId },
      data: {
        totalPercepciones,
        totalDeducciones: centavos(deducciones),
        neto: centavos(totalPercepciones - deducciones),
      },
    });
  });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "ReciboNomina",
    entidadId: reciboId,
    descripcion: `Se agrego ${concepto.nombre} por ${importe}`,
  });

  revalidatePath(`/panel/nomina/recibo/${reciboId}`);
  return { ok: true, mensaje: `${concepto.nombre} agregado por ${importe}.` };
}

export async function quitarLineaRecibo(formData: FormData) {
  const sesion = await requerirRol("ADMIN");
  const detalleId = Number(formData.get("detalleId"));
  const detalle = await db.detalleReciboNomina.findUnique({
    where: { id: detalleId },
    include: { recibo: true, concepto: true },
  });
  if (!detalle || detalle.recibo.estado !== "BORRADOR") return;

  const reciboId = detalle.reciboId;
  const importe = aNumero(detalle.importe);
  const esDeduccion = detalle.concepto.tipo === "DEDUCCION";

  await db.$transaction(async (tx) => {
    await tx.detalleReciboNomina.delete({ where: { id: detalleId } });
    const percepciones = centavos(
      aNumero(detalle.recibo.totalPercepciones) - (esDeduccion ? 0 : importe)
    );
    const deducciones = centavos(
      aNumero(detalle.recibo.totalDeducciones) - (esDeduccion ? importe : 0)
    );
    await tx.reciboNomina.update({
      where: { id: reciboId },
      data: {
        totalPercepciones: percepciones,
        totalDeducciones: deducciones,
        neto: centavos(percepciones - deducciones),
      },
    });
  });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "ReciboNomina",
    entidadId: reciboId,
    descripcion: `Se quito ${detalle.concepto.nombre} por ${importe}`,
  });
  revalidatePath(`/panel/nomina/recibo/${reciboId}`);
}

/// Autoriza todos los recibos en borrador del periodo.
export async function autorizarPeriodo(
  _previo: EstadoNomina,
  formData: FormData
): Promise<EstadoNomina> {
  const sesion = await requerirRol("ADMIN");
  const periodoId = entero(formData, "periodoId");
  if (!periodoId) return { error: "Periodo no identificado." };

  const recibos = await db.reciboNomina.findMany({ where: { periodoId } });
  if (recibos.length === 0) return { error: "Calcula la nomina antes de autorizarla." };

  const enCero = recibos.filter((recibo) => aNumero(recibo.neto) <= 0);
  if (enCero.length > 0) {
    return {
      error: `Hay ${enCero.length} recibo(s) con neto en cero o negativo. Revisalos antes de autorizar.`,
      detalles: enCero.map((recibo) => `${recibo.folio}: neto ${aNumero(recibo.neto)}`),
    };
  }

  const resultado = await db.reciboNomina.updateMany({
    where: { periodoId, estado: "BORRADOR" },
    data: { estado: "AUTORIZADO" },
  });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "PeriodoNomina",
    entidadId: periodoId,
    descripcion: `Se autorizaron ${resultado.count} recibo(s)`,
  });

  revalidatePath(`/panel/nomina/${periodoId}`);
  return { ok: true, mensaje: `Se autorizaron ${resultado.count} recibo(s).` };
}

/// Marca el periodo como pagado con el metodo y la fecha capturados.
export async function pagarPeriodo(
  _previo: EstadoNomina,
  formData: FormData
): Promise<EstadoNomina> {
  const sesion = await requerirRol("ADMIN");
  const periodoId = entero(formData, "periodoId");
  const metodoPago = texto(formData, "metodoPago") as MetodoPago;
  const fechaPago = fecha(formData, "fechaPago") ?? new Date();
  if (!periodoId) return { error: "Periodo no identificado." };

  const pendientes = await db.reciboNomina.count({ where: { periodoId, estado: "BORRADOR" } });
  if (pendientes > 0) {
    return { error: `Faltan ${pendientes} recibo(s) por autorizar.` };
  }

  const resultado = await db.reciboNomina.updateMany({
    where: { periodoId, estado: "AUTORIZADO" },
    data: { estado: "PAGADO", metodoPago, fechaPago },
  });
  await db.periodoNomina.update({
    where: { id: periodoId },
    data: { estado: "PAGADO", cerradoPor: sesion.usuarioId },
  });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "PeriodoNomina",
    entidadId: periodoId,
    descripcion: `Periodo pagado: ${resultado.count} recibo(s) por ${metodoPago}`,
  });

  revalidatePath(`/panel/nomina/${periodoId}`);
  return { ok: true, mensaje: `Periodo pagado: ${resultado.count} recibo(s).` };
}

export async function cancelarRecibo(
  _previo: EstadoNomina,
  formData: FormData
): Promise<EstadoNomina> {
  const sesion = await requerirRol("ADMIN");
  const reciboId = entero(formData, "reciboId");
  const motivo = texto(formData, "motivo");
  if (!reciboId) return { error: "Recibo no identificado." };
  if (motivo.length < 5) return { error: "Escribe el motivo de la cancelacion." };

  const recibo = await db.reciboNomina.findUnique({ where: { id: reciboId } });
  if (!recibo) return { error: "El recibo no existe." };
  if (recibo.estado === "CANCELADO") return { error: "Ese recibo ya estaba cancelado." };

  await db.reciboNomina.update({
    where: { id: reciboId },
    data: { estado: "CANCELADO", observaciones: motivo },
  });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CANCELAR",
    entidad: "ReciboNomina",
    entidadId: reciboId,
    datosAntes: { estado: recibo.estado, neto: aNumero(recibo.neto) },
    datosDespues: { estado: "CANCELADO" },
    descripcion: `Recibo ${recibo.folio} cancelado: ${motivo}`,
  });

  revalidatePath(`/panel/nomina/${recibo.periodoId}`);
  revalidatePath(`/panel/nomina/recibo/${reciboId}`);
  return { ok: true, mensaje: `Recibo ${recibo.folio} cancelado.` };
}
