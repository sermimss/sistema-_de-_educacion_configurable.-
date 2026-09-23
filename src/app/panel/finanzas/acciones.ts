"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";

export type EstadoFinanzas = {
  error?: string;
  detalles?: string[];
  ok?: boolean;
  mensaje?: string;
};

function texto(formData: FormData, clave: string): string {
  return String(formData.get(clave) ?? "").trim();
}
function textoONulo(formData: FormData, clave: string): string | null {
  const valor = texto(formData, clave);
  return valor ? valor : null;
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
  if (!valor) return null;
  const parseada = new Date(`${valor}T00:00:00.000Z`);
  return Number.isNaN(parseada.getTime()) ? null : parseada;
}
function activo(formData: FormData, clave: string): boolean {
  return formData.get(clave) === "on";
}

const TIPOS_CONCEPTO = [
  "INSCRIPCION", "REINSCRIPCION", "COLEGIATURA", "MATERIAL", "UNIFORME",
  "TRANSPORTE", "EVENTO", "EXAMEN", "TRAMITE", "OTRO",
] as const;

const PERIODICIDADES = [
  "UNICO", "MENSUAL", "BIMESTRAL", "POR_PERIODO_ACADEMICO", "SEMESTRAL", "ANUAL",
] as const;

const AMBITOS = ["TODOS", "NIVEL", "PLAN", "GRADO", "GRUPO", "ALUMNO"] as const;

/// Alta o edicion de un concepto de cobro. Aqui el colegio define el motivo,
/// el monto, cuando se cobra, cuantas veces y a quien aplica.
export async function guardarConcepto(
  _previo: EstadoFinanzas,
  formData: FormData
): Promise<EstadoFinanzas> {
  const sesion = await requerirRol("ADMIN");
  const id = entero(formData, "id");

  const clave = texto(formData, "clave").toUpperCase();
  const nombre = texto(formData, "nombre");
  const montoBase = numero(formData, "montoBase");
  const tipo = texto(formData, "tipo") as (typeof TIPOS_CONCEPTO)[number];
  const periodicidad = texto(formData, "periodicidad") as (typeof PERIODICIDADES)[number];
  const ambito = (texto(formData, "ambito") || "TODOS") as (typeof AMBITOS)[number];
  const referenciaId = entero(formData, "referenciaId");
  const diaVencimiento = entero(formData, "diaVencimiento");
  const numeroCargos = entero(formData, "numeroCargos");
  const tasaIva = numero(formData, "tasaIva");

  if (!clave) return { error: "La clave del concepto es obligatoria." };
  if (nombre.length < 2) return { error: "Escribe el motivo del cobro." };
  if (montoBase == null || montoBase < 0) return { error: "El monto no puede ser negativo." };
  if (!TIPOS_CONCEPTO.includes(tipo)) return { error: "Tipo de concepto no reconocido." };
  if (!PERIODICIDADES.includes(periodicidad)) return { error: "Periodicidad no reconocida." };
  if (diaVencimiento != null && (diaVencimiento < 1 || diaVencimiento > 31)) {
    return { error: "El dia de vencimiento debe estar entre 1 y 31." };
  }
  if (numeroCargos != null && (numeroCargos < 1 || numeroCargos > 60)) {
    return { error: "El numero de cargos debe estar entre 1 y 60." };
  }
  if (ambito !== "TODOS" && !referenciaId) {
    return { error: `Si el cobro aplica por ${ambito.toLowerCase()}, elige a cual.` };
  }
  if (tasaIva != null && (tasaIva < 0 || tasaIva > 1)) {
    return { error: "El IVA se captura como fraccion: 0 para exento, 0.16 para 16%." };
  }

  const datos = {
    clave,
    nombre,
    leyenda: textoONulo(formData, "leyenda"),
    descripcion: textoONulo(formData, "descripcion"),
    tipo,
    montoBase,
    periodicidad,
    ambito,
    referenciaId: ambito === "TODOS" ? null : referenciaId,
    diaVencimiento,
    fechaPrimerCargo: fecha(formData, "fechaPrimerCargo"),
    numeroCargos,
    obligatorio: activo(formData, "obligatorio"),
    generaRecargo: activo(formData, "generaRecargo"),
    aplicaDescuentos: activo(formData, "aplicaDescuentos"),
    activo: activo(formData, "activo"),
    tasaIva,
    claveProdServSat: textoONulo(formData, "claveProdServSat"),
    claveUnidadSat: textoONulo(formData, "claveUnidadSat"),
  };

  try {
    if (id) {
      const antes = await db.conceptoCobro.findUnique({ where: { id } });
      const despues = await db.conceptoCobro.update({ where: { id }, data: datos });
      await registrarBitacora({
        usuarioId: sesion.usuarioId,
        accion: "ACTUALIZAR",
        entidad: "ConceptoCobro",
        entidadId: id,
        datosAntes: antes
          ? { nombre: antes.nombre, monto: Number(antes.montoBase), periodicidad: antes.periodicidad }
          : undefined,
        datosDespues: {
          nombre: despues.nombre,
          monto: Number(despues.montoBase),
          periodicidad: despues.periodicidad,
        },
      });
      revalidatePath("/panel/finanzas/conceptos");
      return { ok: true, mensaje: `Concepto ${despues.nombre} actualizado.` };
    }

    const total = await db.conceptoCobro.count();
    const creado = await db.conceptoCobro.create({ data: { ...datos, orden: total } });
    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "CREAR",
      entidad: "ConceptoCobro",
      entidadId: creado.id,
      descripcion: `${creado.nombre} por ${Number(creado.montoBase)} (${creado.periodicidad})`,
    });
    revalidatePath("/panel/finanzas/conceptos");
    return { ok: true, mensaje: `Concepto ${creado.nombre} creado.` };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido.";
    return {
      error: mensaje.includes("Unique constraint")
        ? `Ya existe un concepto con la clave ${clave}.`
        : `No se pudo guardar: ${mensaje}`,
    };
  }
}

export async function alternarConcepto(formData: FormData) {
  const sesion = await requerirRol("ADMIN");
  const id = Number(formData.get("conceptoId"));
  const concepto = await db.conceptoCobro.findUnique({ where: { id } });
  if (!concepto) return;

  await db.conceptoCobro.update({ where: { id }, data: { activo: !concepto.activo } });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "ConceptoCobro",
    entidadId: id,
    datosAntes: { activo: concepto.activo },
    datosDespues: { activo: !concepto.activo },
  });
  revalidatePath("/panel/finanzas/conceptos");
}

export async function eliminarConcepto(
  _previo: EstadoFinanzas,
  formData: FormData
): Promise<EstadoFinanzas> {
  const sesion = await requerirRol("ADMIN");
  const id = Number(formData.get("conceptoId"));
  const concepto = await db.conceptoCobro.findUnique({
    where: { id },
    include: { _count: { select: { cargos: true } } },
  });
  if (!concepto) return { error: "El concepto ya no existe." };
  if (concepto._count.cargos > 0) {
    return {
      error: `No se puede borrar ${concepto.nombre}: ya tiene ${concepto._count.cargos} cargo(s) generados. Desactivalo para que deje de usarse.`,
    };
  }

  await db.conceptoCobro.delete({ where: { id } });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ELIMINAR",
    entidad: "ConceptoCobro",
    entidadId: id,
    descripcion: `Concepto ${concepto.nombre} eliminado`,
  });
  revalidatePath("/panel/finanzas/conceptos");
  return { ok: true, mensaje: "Concepto eliminado." };
}

/// Reglas de recargo por pago tardio.
export async function guardarRecargo(
  _previo: EstadoFinanzas,
  formData: FormData
): Promise<EstadoFinanzas> {
  const sesion = await requerirRol("ADMIN");
  const id = entero(formData, "id");
  const nombre = texto(formData, "nombre");
  const valor = numero(formData, "valor");
  const diasGracia = entero(formData, "diasGracia") ?? 0;
  const topeMaximo = numero(formData, "topeMaximo");
  const tipoCalculo = texto(formData, "tipoCalculo") as "FIJO" | "PORCENTAJE";
  const frecuencia = texto(formData, "frecuencia") as "UNICA" | "DIARIA" | "SEMANAL" | "MENSUAL";

  if (nombre.length < 3) return { error: "Escribe el nombre de la regla." };
  if (valor == null || valor <= 0) return { error: "El valor del recargo debe ser mayor a 0." };
  if (tipoCalculo === "PORCENTAJE" && valor > 100) {
    return { error: "Un recargo en porcentaje no puede pasar de 100." };
  }
  if (diasGracia < 0 || diasGracia > 60) return { error: "Los dias de gracia van de 0 a 60." };

  const datos = {
    nombre,
    tipoCalculo,
    valor,
    diasGracia,
    frecuencia,
    topeMaximo,
    aplicaATodos: activo(formData, "aplicaATodos"),
    activa: activo(formData, "activa"),
  };

  if (id) {
    await db.reglaRecargo.update({ where: { id }, data: datos });
  } else {
    await db.reglaRecargo.create({ data: datos });
  }

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: id ? "ACTUALIZAR" : "CREAR",
    entidad: "ReglaRecargo",
    entidadId: id ?? undefined,
    descripcion: `${nombre}: ${valor}${tipoCalculo === "PORCENTAJE" ? "%" : ""} tras ${diasGracia} dia(s)`,
  });
  revalidatePath("/panel/finanzas/conceptos");
  return { ok: true, mensaje: id ? "Regla actualizada." : "Regla creada." };
}

export async function eliminarRecargo(formData: FormData) {
  const sesion = await requerirRol("ADMIN");
  const id = Number(formData.get("recargoId"));
  await db.reglaRecargo.delete({ where: { id } });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ELIMINAR",
    entidad: "ReglaRecargo",
    entidadId: id,
  });
  revalidatePath("/panel/finanzas/conceptos");
}

/// Becas y descuentos del catalogo.
export async function guardarDescuento(
  _previo: EstadoFinanzas,
  formData: FormData
): Promise<EstadoFinanzas> {
  const sesion = await requerirRol("ADMIN");
  const id = entero(formData, "id");
  const nombre = texto(formData, "nombre");
  const valor = numero(formData, "valor");
  const tipoCalculo = texto(formData, "tipoCalculo") as "FIJO" | "PORCENTAJE";

  if (nombre.length < 3) return { error: "Escribe el nombre de la beca o descuento." };
  if (valor == null || valor <= 0) return { error: "El valor debe ser mayor a 0." };
  if (tipoCalculo === "PORCENTAJE" && valor > 100) {
    return { error: "Un descuento en porcentaje no puede pasar de 100." };
  }

  const conceptos = formData
    .getAll("conceptos")
    .map((valorCrudo) => Number(valorCrudo))
    .filter((numeroId) => Number.isInteger(numeroId) && numeroId > 0);

  const datos = {
    nombre,
    descripcion: textoONulo(formData, "descripcion"),
    tipoCalculo,
    valor,
    acumulable: activo(formData, "acumulable"),
    requiereAutorizacion: activo(formData, "requiereAutorizacion"),
    aplicaATodos: conceptos.length === 0,
    vigenciaInicio: fecha(formData, "vigenciaInicio"),
    vigenciaFin: fecha(formData, "vigenciaFin"),
    activo: activo(formData, "activo"),
  };

  // Sin conceptos elegidos, el descuento aplica a todo el catalogo.
  const referencias = conceptos.map((idConcepto) => ({ id: idConcepto }));

  if (id) {
    await db.descuento.update({
      where: { id },
      data: { ...datos, conceptos: { set: referencias } },
    });
  } else {
    await db.descuento.create({
      data: { ...datos, conceptos: referencias.length > 0 ? { connect: referencias } : undefined },
    });
  }

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: id ? "ACTUALIZAR" : "CREAR",
    entidad: "Descuento",
    entidadId: id ?? undefined,
    descripcion: `${nombre}: ${valor}${tipoCalculo === "PORCENTAJE" ? "%" : ""}`,
  });
  revalidatePath("/panel/finanzas/becas");
  return { ok: true, mensaje: id ? "Descuento actualizado." : "Descuento creado." };
}

/// Asigna una beca a un alumno concreto.
export async function asignarBeca(
  _previo: EstadoFinanzas,
  formData: FormData
): Promise<EstadoFinanzas> {
  const sesion = await requerirRol("ADMIN");
  const alumnoId = entero(formData, "alumnoId");
  const descuentoId = entero(formData, "descuentoId");
  const cicloId = entero(formData, "cicloId");

  if (!alumnoId || !descuentoId) return { error: "Selecciona el alumno y la beca." };

  const [alumno, descuento] = await Promise.all([
    db.alumno.findUnique({ where: { id: alumnoId } }),
    db.descuento.findUnique({ where: { id: descuentoId } }),
  ]);
  if (!alumno || !descuento) return { error: "El alumno o la beca no existen." };

  try {
    await db.descuentoAlumno.create({
      data: {
        alumnoId,
        descuentoId,
        cicloId,
        autorizadoPor: sesion.usuarioId,
        observaciones: textoONulo(formData, "observaciones"),
      },
    });
  } catch {
    return { error: "Ese alumno ya tiene asignada esa beca en el mismo ciclo." };
  }

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "DescuentoAlumno",
    entidadId: alumnoId,
    descripcion: `Beca ${descuento.nombre} asignada a ${alumno.matricula}`,
  });
  revalidatePath("/panel/finanzas/becas");
  return {
    ok: true,
    mensaje: `${descuento.nombre} asignada a ${alumno.nombres} ${alumno.apellidoPaterno}. Vuelve a generar los cargos para que se aplique.`,
  };
}

export async function quitarBeca(formData: FormData) {
  const sesion = await requerirRol("ADMIN");
  const id = Number(formData.get("asignacionId"));
  const asignacion = await db.descuentoAlumno.findUnique({
    where: { id },
    include: { alumno: true, descuento: true },
  });
  await db.descuentoAlumno.delete({ where: { id } });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ELIMINAR",
    entidad: "DescuentoAlumno",
    entidadId: id,
    descripcion: `Beca ${asignacion?.descuento.nombre ?? id} retirada de ${asignacion?.alumno.matricula ?? ""}`,
  });
  revalidatePath("/panel/finanzas/becas");
}
