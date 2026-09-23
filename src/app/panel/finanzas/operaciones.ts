"use server";

import { revalidatePath } from "next/cache";
import type { MetodoPago } from "@prisma/client";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { configBool, configNumero, configTexto } from "@/lib/configuracion";
import {
  actualizarBanderaAdeudo,
  aNumero,
  centavos,
  resumenDeCuenta,
  siguienteFolioCargo,
  siguienteFolioPago,
} from "@/lib/finanzas";
import {
  actualizarRecargos,
  generarCargos,
  recalcularCargo,
  type LineaPrevia,
} from "@/lib/generacionCargos";
import type { EstadoFinanzas } from "./acciones";

export type EstadoGeneracion = EstadoFinanzas & {
  vistaPrevia?: {
    lineas: (Omit<LineaPrevia, "fechaVencimiento"> & { fechaVencimiento: string })[];
    creados: number;
    omitidos: number;
    montoTotal: number;
  };
};

const METODOS: MetodoPago[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "TARJETA_CREDITO",
  "TARJETA_DEBITO",
  "CHEQUE",
  "DEPOSITO",
  "PAGO_EN_LINEA",
  "OTRO",
];

function entero(formData: FormData, clave: string): number | null {
  const valor = String(formData.get(clave) ?? "").trim();
  if (!valor) return null;
  const parseado = Number(valor);
  return Number.isInteger(parseado) ? parseado : null;
}

function decimal(formData: FormData, clave: string): number | null {
  const valor = String(formData.get(clave) ?? "").trim();
  if (!valor) return null;
  const parseado = Number(valor);
  return Number.isFinite(parseado) ? centavos(parseado) : null;
}

/// Calcula los cargos del ciclo. Con "vistaPrevia" solo muestra lo que haria.
export async function accionGenerarCargos(
  _previo: EstadoGeneracion,
  formData: FormData
): Promise<EstadoGeneracion> {
  const sesion = await requerirRol("ADMIN");
  const cicloId = entero(formData, "cicloId");
  if (!cicloId) return { error: "Selecciona el ciclo escolar." };

  const soloVistaPrevia = formData.get("accion") !== "confirmar";
  const grupoId = entero(formData, "grupoId");
  const alumnoId = entero(formData, "alumnoId");

  const resultado = await generarCargos(
    { cicloId, grupoId, alumnoId },
    { soloVistaPrevia, creadoPor: sesion.usuarioId }
  );

  if (soloVistaPrevia) {
    return {
      ok: true,
      mensaje:
        resultado.creados === 0
          ? "No hay cargos nuevos que generar con esta configuracion."
          : `Se generarian ${resultado.creados} cargo(s) por ${resultado.montoTotal}. ${resultado.omitidos} ya existian.`,
      vistaPrevia: {
        lineas: resultado.lineas.slice(0, 200).map((linea) => ({
          ...linea,
          fechaVencimiento: linea.fechaVencimiento.toISOString().slice(0, 10),
        })),
        creados: resultado.creados,
        omitidos: resultado.omitidos,
        montoTotal: resultado.montoTotal,
      },
    };
  }

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "Cargo",
    entidadId: `ciclo-${cicloId}`,
    descripcion: `Generacion de cargos: ${resultado.creados} creados, ${resultado.omitidos} omitidos, total ${resultado.montoTotal}`,
  });

  revalidatePath("/panel/finanzas");
  return {
    ok: true,
    mensaje: `Listo: ${resultado.creados} cargo(s) generados por ${resultado.montoTotal}. Se omitieron ${resultado.omitidos} que ya existian.`,
  };
}

/// Cargo suelto con motivo, monto y fecha libres.
export async function crearCargoManual(
  _previo: EstadoFinanzas,
  formData: FormData
): Promise<EstadoFinanzas> {
  const sesion = await requerirRol("ADMIN");
  const alumnoId = entero(formData, "alumnoId");
  const monto = decimal(formData, "monto");
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const fechaTexto = String(formData.get("fechaVencimiento") ?? "").trim();
  const conceptoId = entero(formData, "conceptoId");

  if (!alumnoId) return { error: "Selecciona el alumno." };
  if (descripcion.length < 3) return { error: "Escribe el motivo del cargo." };
  if (monto == null || monto <= 0) return { error: "El monto debe ser mayor a 0." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaTexto)) return { error: "Captura la fecha de vencimiento." };

  const alumno = await db.alumno.findUnique({ where: { id: alumnoId } });
  if (!alumno) return { error: "El alumno no existe." };

  const cicloActivo = await db.cicloEscolar.findFirst({ where: { estado: "ACTIVO" } });

  const cargo = await db.cargo.create({
    data: {
      folio: await siguienteFolioCargo(),
      alumnoId,
      conceptoId,
      cicloId: cicloActivo?.id ?? null,
      descripcion,
      montoOriginal: monto,
      montoDescuento: 0,
      montoRecargo: 0,
      montoTotal: monto,
      saldo: monto,
      fechaVencimiento: new Date(`${fechaTexto}T00:00:00.000Z`),
      estado: "PENDIENTE",
      generadoAutomatico: false,
      notas: String(formData.get("notas") ?? "").trim() || null,
      creadoPor: sesion.usuarioId,
    },
  });

  await actualizarBanderaAdeudo(alumnoId);
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "Cargo",
    entidadId: cargo.id,
    descripcion: `Cargo manual "${descripcion}" por ${monto} a ${alumno.matricula}`,
  });

  revalidatePath(`/panel/finanzas/alumno/${alumnoId}`);
  return { ok: true, mensaje: `Cargo ${cargo.folio} creado por ${monto}.` };
}

export async function cambiarEstadoCargo(
  _previo: EstadoFinanzas,
  formData: FormData
): Promise<EstadoFinanzas> {
  const sesion = await requerirRol("ADMIN");
  const cargoId = entero(formData, "cargoId");
  const nuevoEstado = String(formData.get("estado") ?? "");
  if (!cargoId) return { error: "Cargo no identificado." };
  if (nuevoEstado !== "CANCELADO" && nuevoEstado !== "CONDONADO") {
    return { error: "Solo se puede cancelar o condonar un cargo." };
  }

  const cargo = await db.cargo.findUnique({
    where: { id: cargoId },
    include: { aplicaciones: { include: { pago: true } } },
  });
  if (!cargo) return { error: "El cargo ya no existe." };

  const pagado = cargo.aplicaciones.filter((a) => a.pago.estado !== "CANCELADO").length;
  if (pagado > 0) {
    return {
      error: "Ese cargo ya tiene pagos aplicados. Cancela primero el pago correspondiente.",
    };
  }

  await db.cargo.update({
    where: { id: cargoId },
    data: { estado: nuevoEstado, saldo: 0, notas: String(formData.get("motivo") ?? "").trim() || cargo.notas },
  });
  await actualizarBanderaAdeudo(cargo.alumnoId);

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CANCELAR",
    entidad: "Cargo",
    entidadId: cargoId,
    datosAntes: { estado: cargo.estado, saldo: aNumero(cargo.saldo) },
    datosDespues: { estado: nuevoEstado },
    descripcion: `Cargo ${cargo.folio} ${nuevoEstado.toLowerCase()}: ${String(formData.get("motivo") ?? "sin motivo")}`,
  });

  revalidatePath(`/panel/finanzas/alumno/${cargo.alumnoId}`);
  return { ok: true, mensaje: `Cargo ${nuevoEstado.toLowerCase()}.` };
}

export async function accionActualizarRecargos(
  _previo: EstadoFinanzas,
  formData: FormData
): Promise<EstadoFinanzas> {
  const sesion = await requerirRol("ADMIN");
  const cicloId = entero(formData, "cicloId");

  const resumen = await actualizarRecargos(cicloId);
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "Cargo",
    entidadId: cicloId ? `ciclo-${cicloId}` : "todos",
    descripcion: `Recargos: ${resumen.actualizados} de ${resumen.revisados} cargos, ${resumen.montoAgregado} agregados`,
  });

  revalidatePath("/panel/finanzas");
  return {
    ok: true,
    mensaje: `Se revisaron ${resumen.revisados} cargo(s) y se actualizaron ${resumen.actualizados}. Diferencia en recargos: ${resumen.montoAgregado}.`,
  };
}

/// Registra un pago y lo aplica a los cargos. Si no se indica cuanto va a cada
/// cargo, se aplica del mas viejo al mas nuevo.
export async function registrarPago(
  _previo: EstadoFinanzas,
  formData: FormData
): Promise<EstadoFinanzas> {
  const sesion = await requerirRol("ADMIN");
  const alumnoId = entero(formData, "alumnoId");
  const monto = decimal(formData, "monto");
  const metodoPago = String(formData.get("metodoPago") ?? "EFECTIVO") as MetodoPago;

  if (!alumnoId) return { error: "Selecciona el alumno." };
  if (monto == null || monto <= 0) return { error: "El monto del pago debe ser mayor a 0." };
  if (!METODOS.includes(metodoPago)) return { error: "Metodo de pago no reconocido." };

  const permiteParciales = await configBool("finanzas.permite_pagos_parciales", true);

  const cargos = await db.cargo.findMany({
    where: { alumnoId, estado: { in: ["PENDIENTE", "PARCIAL", "VENCIDO"] } },
    orderBy: { fechaVencimiento: "asc" },
  });
  if (cargos.length === 0) return { error: "Este alumno no tiene cargos pendientes." };

  // Reparto elegido a mano, si viene.
  const manual = new Map<number, number>();
  for (const [clave, valor] of formData.entries()) {
    if (!clave.startsWith("aplicar_")) continue;
    const cargoId = Number(clave.slice("aplicar_".length));
    const cantidad = Number(String(valor).trim());
    if (cargoId && Number.isFinite(cantidad) && cantidad > 0) manual.set(cargoId, centavos(cantidad));
  }

  const reparto: { cargoId: number; monto: number }[] = [];
  let restante = monto;

  if (manual.size > 0) {
    const sumaManual = centavos([...manual.values()].reduce((a, b) => a + b, 0));
    if (sumaManual > monto) {
      return { error: `El reparto suma ${sumaManual} y el pago es de ${monto}.` };
    }
    for (const [cargoId, cantidad] of manual.entries()) {
      const cargo = cargos.find((c) => c.id === cargoId);
      if (!cargo) return { error: "Uno de los cargos elegidos ya no esta pendiente." };
      const saldo = aNumero(cargo.saldo);
      if (cantidad > saldo) {
        return { error: `${cargo.descripcion}: quieres aplicar ${cantidad} y el saldo es ${saldo}.` };
      }
      if (!permiteParciales && cantidad !== saldo) {
        return { error: "El colegio no permite pagos parciales: cubre el saldo completo del cargo." };
      }
      reparto.push({ cargoId, monto: cantidad });
      restante = centavos(restante - cantidad);
    }
  }

  // Lo que sobre se aplica del cargo mas viejo al mas nuevo.
  for (const cargo of cargos) {
    if (restante <= 0) break;
    if (manual.has(cargo.id)) continue;
    const saldo = aNumero(cargo.saldo);
    if (saldo <= 0) continue;
    const aplicar = Math.min(saldo, restante);
    if (!permiteParciales && aplicar < saldo) break;
    reparto.push({ cargoId: cargo.id, monto: centavos(aplicar) });
    restante = centavos(restante - aplicar);
  }

  if (reparto.length === 0) {
    return { error: "No se pudo aplicar el pago a ningun cargo." };
  }

  const aplicado = centavos(reparto.reduce((suma, fila) => suma + fila.monto, 0));
  const serie = await configTexto("finanzas.serie_recibo", "A");
  const folioInicial = await configNumero("finanzas.folio_recibo_inicial", 1);

  const pago = await db.$transaction(async (tx) => {
    const creado = await tx.pago.create({
      data: {
        folio: await siguienteFolioPago(),
        alumnoId,
        montoTotal: aplicado,
        metodoPago,
        referencia: String(formData.get("referencia") ?? "").trim() || null,
        banco: String(formData.get("banco") ?? "").trim() || null,
        estado: "CONFIRMADO",
        registradoPor: sesion.usuarioId,
        notas: String(formData.get("notas") ?? "").trim() || null,
      },
    });

    for (const fila of reparto) {
      await tx.aplicacionPago.create({
        data: { pagoId: creado.id, cargoId: fila.cargoId, monto: fila.monto },
      });
    }

    const recibosPrevios = await tx.recibo.count({ where: { serie } });
    await tx.recibo.create({
      data: {
        pagoId: creado.id,
        serie,
        folio: String(folioInicial + recibosPrevios),
        subtotal: aplicado,
        impuestos: 0,
        total: aplicado,
        estadoCfdi: "NO_APLICA",
      },
    });

    return creado;
  });

  for (const fila of reparto) await recalcularCargo(fila.cargoId);
  await actualizarBanderaAdeudo(alumnoId);

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "Pago",
    entidadId: pago.id,
    datosDespues: { monto: aplicado, metodoPago, cargos: reparto.length },
    descripcion: `Pago ${pago.folio} por ${aplicado} aplicado a ${reparto.length} cargo(s)`,
  });

  revalidatePath(`/panel/finanzas/alumno/${alumnoId}`);
  const sobrante = centavos(monto - aplicado);
  return {
    ok: true,
    mensaje:
      sobrante > 0
        ? `Pago ${pago.folio} registrado por ${aplicado}. Quedaron ${sobrante} sin aplicar porque no hay mas saldo pendiente.`
        : `Pago ${pago.folio} registrado por ${aplicado} en ${reparto.length} cargo(s).`,
  };
}

export async function cancelarPago(
  _previo: EstadoFinanzas,
  formData: FormData
): Promise<EstadoFinanzas> {
  const sesion = await requerirRol("ADMIN");
  const pagoId = entero(formData, "pagoId");
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!pagoId) return { error: "Pago no identificado." };
  if (motivo.length < 5) return { error: "Escribe el motivo de la cancelacion." };

  const pago = await db.pago.findUnique({
    where: { id: pagoId },
    include: { aplicaciones: true, recibo: true },
  });
  if (!pago) return { error: "El pago no existe." };
  if (pago.estado === "CANCELADO") return { error: "Ese pago ya estaba cancelado." };

  await db.$transaction(async (tx) => {
    await tx.pago.update({
      where: { id: pagoId },
      data: {
        estado: "CANCELADO",
        canceladoEn: new Date(),
        canceladoPor: sesion.usuarioId,
        motivoCancelacion: motivo,
      },
    });
    if (pago.recibo) {
      await tx.recibo.update({
        where: { id: pago.recibo.id },
        data: { estadoCfdi: pago.recibo.estadoCfdi === "TIMBRADO" ? "CANCELADO" : "NO_APLICA" },
      });
    }
  });

  for (const aplicacion of pago.aplicaciones) await recalcularCargo(aplicacion.cargoId);
  await actualizarBanderaAdeudo(pago.alumnoId);

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CANCELAR",
    entidad: "Pago",
    entidadId: pagoId,
    datosAntes: { estado: pago.estado, monto: aNumero(pago.montoTotal) },
    datosDespues: { estado: "CANCELADO" },
    descripcion: `Pago ${pago.folio} cancelado: ${motivo}`,
  });

  revalidatePath(`/panel/finanzas/alumno/${pago.alumnoId}`);
  return { ok: true, mensaje: `Pago ${pago.folio} cancelado y saldos restaurados.` };
}

/// Convenio de pago: parte el saldo vencido en parcialidades con su fecha.
export async function crearConvenio(
  _previo: EstadoFinanzas,
  formData: FormData
): Promise<EstadoFinanzas> {
  const sesion = await requerirRol("ADMIN");
  const alumnoId = entero(formData, "alumnoId");
  const parcialidades = entero(formData, "parcialidades");
  const primeraFecha = String(formData.get("primeraFecha") ?? "").trim();

  if (!(await configBool("finanzas.permite_convenios", true))) {
    return { error: "El colegio tiene desactivados los convenios de pago." };
  }
  if (!alumnoId) return { error: "Selecciona el alumno." };
  if (!parcialidades || parcialidades < 2 || parcialidades > 24) {
    return { error: "El convenio debe tener entre 2 y 24 parcialidades." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(primeraFecha)) {
    return { error: "Captura la fecha de la primera parcialidad." };
  }

  const cargosElegidos = formData
    .getAll("cargos")
    .map((valor) => Number(valor))
    .filter((id) => Number.isInteger(id) && id > 0);

  const cargos = await db.cargo.findMany({
    where: {
      alumnoId,
      estado: { in: ["PENDIENTE", "PARCIAL", "VENCIDO"] },
      ...(cargosElegidos.length > 0 ? { id: { in: cargosElegidos } } : {}),
    },
  });
  if (cargos.length === 0) return { error: "No hay cargos pendientes que incluir en el convenio." };

  const montoTotal = centavos(cargos.reduce((suma, cargo) => suma + aNumero(cargo.saldo), 0));
  if (montoTotal <= 0) return { error: "El saldo de esos cargos ya esta cubierto." };

  const total = await db.convenioPago.count();
  const base = new Date(`${primeraFecha}T00:00:00.000Z`);
  const porParcialidad = centavos(montoTotal / parcialidades);

  const convenio = await db.$transaction(async (tx) => {
    const creado = await tx.convenioPago.create({
      data: {
        folio: `CV-${new Date().getFullYear()}-${String(total + 1).padStart(4, "0")}`,
        alumnoId,
        numeroParcialidades: parcialidades,
        montoTotal,
        fechaInicio: base,
        estado: "VIGENTE",
        autorizadoPor: sesion.usuarioId,
        notas: String(formData.get("notas") ?? "").trim() || null,
      },
    });

    for (let numero = 1; numero <= parcialidades; numero++) {
      // La ultima parcialidad absorbe la diferencia por redondeo.
      const monto =
        numero === parcialidades
          ? centavos(montoTotal - porParcialidad * (parcialidades - 1))
          : porParcialidad;
      const vencimiento = new Date(
        Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + (numero - 1), base.getUTCDate())
      );
      await tx.parcialidadConvenio.create({
        data: { convenioId: creado.id, numero, monto, fechaVencimiento: vencimiento },
      });
    }

    await tx.cargo.updateMany({
      where: { id: { in: cargos.map((cargo) => cargo.id) } },
      data: { convenioId: creado.id },
    });

    return creado;
  });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "ConvenioPago",
    entidadId: convenio.id,
    descripcion: `Convenio ${convenio.folio} por ${montoTotal} en ${parcialidades} parcialidades`,
  });

  revalidatePath(`/panel/finanzas/alumno/${alumnoId}`);
  return {
    ok: true,
    mensaje: `Convenio ${convenio.folio} creado: ${montoTotal} en ${parcialidades} parcialidades de ${porParcialidad}.`,
  };
}

/// Resumen de caja del dia para la pantalla principal de finanzas.
export async function resumenDelAlumno(alumnoId: number) {
  return resumenDeCuenta(alumnoId);
}
