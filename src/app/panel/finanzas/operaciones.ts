"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { aplicarSaldoAFavor, conCandado } from "@/lib/cobranza";
import { esFechaDia, fechaHoraAInstante, hoyEnZona } from "@/lib/fechasDia";
import { obtenerInstitucion } from "@/lib/institucion";
import { procesarPago, type EstadoPago } from "@/lib/registroPago";
import { formatearMoneda } from "@/lib/formato";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { configBool } from "@/lib/configuracion";
import {
  actualizarBanderaAdeudo,
  aNumero,
  centavos,
  siguienteFolioCargo,
} from "@/lib/finanzas";
import {
  actualizarRecargos,
  generarCargos,
  recalcularCargo,
  type LineaPrevia,
} from "@/lib/generacionCargos";
import { cicloVigenteDeAlumno } from "@/lib/calendarioGrupo";
import type { EstadoFinanzas } from "./acciones";

export type EstadoGeneracion = EstadoFinanzas & {
  vistaPrevia?: {
    lineas: (Omit<LineaPrevia, "fechaVencimiento"> & { fechaVencimiento: string })[];
    creados: number;
    omitidos: number;
    montoTotal: number;
  };
};

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

/// Calcula los cargos. Cada grupo tiene sus propias fechas de clases, asi
/// que las colegiaturas de cada alumno salen de las fechas de su grupo. Con
/// "vistaPrevia" solo muestra lo que haria.
export async function accionGenerarCargos(
  _previo: EstadoGeneracion,
  formData: FormData
): Promise<EstadoGeneracion> {
  const sesion = await requerirRol("ADMIN");
  const soloVistaPrevia = formData.get("accion") !== "confirmar";
  const grupoId = entero(formData, "grupoId");
  // Un solo alumno, por su matricula.
  const matricula = String(formData.get("matricula") ?? "").trim();
  let alumnoId: number | null = null;
  if (matricula) {
    const alumno = await db.alumno.findFirst({ where: { matricula: { equals: matricula, mode: "insensitive" } }, select: { id: true } });
    if (!alumno) return { error: `No hay ningun alumno con la matricula ${matricula}.` };
    alumnoId = alumno.id;
  }

  // Que calendarios de grupo recorrer.
  let ciclos: number[];
  if (grupoId) {
    const grupo = await db.grupo.findUnique({ where: { id: grupoId } });
    if (!grupo) return { error: "El grupo no existe." };
    ciclos = [grupo.cicloId];
  } else if (alumnoId) {
    const inscripciones = await db.inscripcion.findMany({
      where: { alumnoId, estado: "INSCRITO" },
      select: { cicloId: true },
    });
    ciclos = [...new Set(inscripciones.map((i) => i.cicloId))];
  } else {
    const grupos = await db.grupo.findMany({
      where: { activo: true, ciclo: { estado: "ACTIVO" } },
      select: { cicloId: true },
    });
    ciclos = [...new Set(grupos.map((g) => g.cicloId))];
  }
  if (ciclos.length === 0) {
    return { error: "No hay alumnos inscritos en grupos activos con esa seleccion." };
  }

  const resultado: Awaited<ReturnType<typeof generarCargos>> = {
    lineas: [],
    creados: 0,
    omitidos: 0,
    montoTotal: 0,
  };
  for (const cicloId of ciclos) {
    const parcial = await generarCargos(
      { cicloId, grupoId, alumnoId },
      { soloVistaPrevia, creadoPor: sesion.usuarioId }
    );
    resultado.lineas.push(...parcial.lineas);
    resultado.creados += parcial.creados;
    resultado.omitidos += parcial.omitidos;
    resultado.montoTotal = centavos(resultado.montoTotal + parcial.montoTotal);
  }

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

  // Quien tenia saldo a favor lo usa en sus cargos nuevos.
  for (const id of new Set(resultado.lineas.filter((l) => !l.yaExiste).map((l) => l.alumnoId))) {
    await conCandado(async (tx) => {
      if ((await aplicarSaldoAFavor(id, tx)) > 0) await actualizarBanderaAdeudo(id, tx);
    });
  }

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "Cargo",
    entidadId: grupoId ? `grupo-${grupoId}` : alumnoId ? `alumno-${alumnoId}` : "todos",
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

  // El cargo se liga al calendario del grupo en el que el alumno esta hoy.
  const cicloVigente = await cicloVigenteDeAlumno(alumnoId);

  const cargo = await db.cargo.create({
    data: {
      folio: await siguienteFolioCargo(),
      alumnoId,
      conceptoId,
      cicloId: cicloVigente?.id ?? null,
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

  const usado = await conCandado(async (tx) => {
    const aplicado = await aplicarSaldoAFavor(alumnoId, tx);
    await actualizarBanderaAdeudo(alumnoId, tx);
    return aplicado;
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "Cargo",
    entidadId: cargo.id,
    descripcion: `Cargo manual "${descripcion}" por ${monto} a ${alumno.matricula}`,
  });

  revalidatePath(`/panel/finanzas/alumno/${alumnoId}`);
  return {
    ok: true,
    mensaje: `Cargo ${cargo.folio} creado por ${monto}.${usado > 0 ? ` Se cubrieron ${usado} con su saldo a favor.` : ""}`,
  };
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

  const resumen = await conCandado((tx) => actualizarRecargos({ cicloId }, tx));
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
///
/// - Todo ocurre con la caja bloqueada (ver conCandado): dos cobros al mismo
///   tiempo no sacan el mismo folio ni cubren dos veces el mismo saldo.
/// - Antes de repartir se ponen los recargos al dia de hoy.
/// - Si sobra dinero: en efectivo es cambio (se registra lo aplicado y se
///   dice cuanto devolver); en los demas metodos queda como saldo a favor.
/// - Si el mismo formulario llega dos veces, el segundo no crea otro pago.
export type { EstadoPago } from "@/lib/registroPago";

export async function registrarPago(previo: EstadoPago, formData: FormData): Promise<EstadoPago> {
  const sesion = await requerirRol("ADMIN", "CAJERO");
  return procesarPago(sesion, formData);
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

  const resultado = await conCandado(async (tx) => {
    const pago = await tx.pago.findUnique({
      where: { id: pagoId },
      include: { aplicaciones: true, recibo: true, turno: true },
    });
    if (!pago) return { error: "El pago no existe." } as const;
    if (pago.estado === "CANCELADO") return { error: "Ese pago ya estaba cancelado." } as const;
    // El corte cerrado no cambia: sus pagos ya no se cancelan.
    if (pago.turno?.estado === "CERRADO") {
      return { error: `Ese pago es del corte #${pago.turno.id}, que ya se cerro: no se puede cancelar. Si hace falta, agrega un cargo de ajuste.` } as const;
    }
    await tx.pago.update({
      where: { id: pagoId },
      data: { estado: "CANCELADO", canceladoEn: new Date(), canceladoPor: sesion.usuarioId, motivoCancelacion: motivo },
    });
    if (pago.recibo) {
      await tx.recibo.update({
        where: { id: pago.recibo.id },
        data: { estadoCfdi: pago.recibo.estadoCfdi === "TIMBRADO" ? "CANCELADO" : "NO_APLICA" },
      });
    }
    for (const aplicacion of pago.aplicaciones) await recalcularCargo(aplicacion.cargoId, tx);
    // Si el alumno tenia otro saldo a favor, cubre lo que quedo pendiente.
    await aplicarSaldoAFavor(pago.alumnoId, tx);
    await actualizarBanderaAdeudo(pago.alumnoId, tx);
    return { pago } as const;
  });
  if ("error" in resultado) return { error: resultado.error };
  const { pago } = resultado;

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
