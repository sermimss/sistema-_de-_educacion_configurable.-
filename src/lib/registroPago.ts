import type { MetodoPago } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import type { DatosSesion } from "./sesion";
import { registrarBitacora } from "./bitacora";
import { configBool, configNumero, configTexto } from "./configuracion";
import { actualizarBanderaAdeudo, aNumero, centavos, siguienteFolioPago } from "./finanzas";
import { recalcularCargo } from "./generacionCargos";
import { conCandado, cuentaAlDia, requiereReferencia } from "./cobranza";
import { esFechaDia, fechaHoraAInstante, hoyEnZona } from "./fechasDia";
import { obtenerInstitucion } from "./institucion";
import { formatearMoneda } from "./formato";
import { turnoAbierto } from "./caja";

/// Registro de un pago, compartido por la caja, el estado de cuenta y la
/// confirmacion de comprobantes. Quien llama ya verifico el rol: esta funcion
/// recibe la sesion y NO es una accion del servidor (no se puede llamar desde
/// el navegador).

export type EstadoFinanzasBase = { error?: string; detalles?: string[]; ok?: boolean; mensaje?: string };

const METODOS: MetodoPago[] = ["EFECTIVO", "TRANSFERENCIA", "TARJETA_CREDITO", "TARJETA_DEBITO", "CHEQUE", "DEPOSITO", "PAGO_EN_LINEA", "OTRO"];

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

export type EstadoPago = EstadoFinanzasBase & {
  duplicado?: { folio: string; alumno: string; fecha: string; monto: string };
  /// Para abrir el recibo listo para imprimir desde la caja.
  pagoId?: number;
  sinCaja?: boolean;
};

export async function procesarPago(sesion: DatosSesion, formData: FormData): Promise<EstadoPago> {
  const alumnoId = entero(formData, "alumnoId");
  const monto = decimal(formData, "monto");
  const metodoPago = String(formData.get("metodoPago") ?? "EFECTIVO") as MetodoPago;
  const referencia = String(formData.get("referencia") ?? "").trim();
  const claveCaptura = String(formData.get("claveCaptura") ?? "").trim().slice(0, 80) || null;
  const institucion = await obtenerInstitucion();
  const zona = institucion?.zonaHoraria ?? "America/Mexico_City";
  const moneda = institucion?.moneda ?? "MXN";
  const dinero = (n: number) => formatearMoneda(n, moneda);

  if (!alumnoId) return { error: "Selecciona el alumno." };
  if (monto == null || monto <= 0) return { error: "El monto del pago debe ser mayor a 0." };
  if (!METODOS.includes(metodoPago)) return { error: "Metodo de pago no reconocido." };
  if (requiereReferencia(metodoPago) && !referencia) {
    return { error: "Escribe la referencia (numero de operacion, autorizacion o cheque): sin ella no se puede conciliar con el banco." };
  }

  // Fecha en que se recibio el dinero: hoy o cualquier dia anterior.
  const hoy = hoyEnZona(zona);
  const fechaTexto = String(formData.get("fechaRecibido") ?? "").trim() || hoy;
  if (!esFechaDia(fechaTexto)) return { error: "Indica la fecha en que se recibio el pago." };
  if (fechaTexto > hoy) return { error: "La fecha del pago no puede ser futura." };
  const fechaPago = fechaTexto === hoy ? new Date() : fechaHoraAInstante(`${fechaTexto}T12:00`, zona)!;

  // Mismo formulario enviado dos veces (doble clic, red lenta): no duplicar.
  if (claveCaptura) {
    const previo = await db.pago.findUnique({ where: { claveCaptura } });
    if (previo) return { ok: true, mensaje: `Ese pago ya estaba registrado con el folio ${previo.folio}; no se duplico.` };
  }

  // Referencia repetida: avisar y pedir confirmacion.
  if (referencia && formData.get("confirmarDuplicado") !== "1") {
    const repetido = await db.pago.findFirst({
      where: { metodoPago, referencia: { equals: referencia, mode: "insensitive" }, estado: { not: "CANCELADO" } },
      include: { alumno: true },
      orderBy: { fecha: "desc" },
    });
    if (repetido) {
      return {
        error: "Ya hay un pago con esa misma referencia y metodo. Revisa que no sea el mismo antes de registrarlo.",
        duplicado: {
          folio: repetido.folio,
          alumno: `${repetido.alumno.matricula} · ${repetido.alumno.nombres} ${repetido.alumno.apellidoPaterno}`,
          fecha: repetido.fecha.toISOString().slice(0, 10),
          monto: dinero(aNumero(repetido.montoTotal)),
        },
      };
    }
  }

  const alumno = await db.alumno.findUnique({ where: { id: alumnoId }, select: { id: true } });
  if (!alumno) return { error: "El alumno no existe." };

  const permiteParciales = await configBool("finanzas.permite_pagos_parciales", true);
  const serie = await configTexto("finanzas.serie_recibo", "A");
  const folioInicial = await configNumero("finanzas.folio_recibo_inicial", 1);
  const efectivo = metodoPago === "EFECTIVO";

  // Reparto elegido a mano, si viene.
  const manual = new Map<number, number>();
  for (const [clave, valor] of formData.entries()) {
    if (!clave.startsWith("aplicar_")) continue;
    const cargoId = Number(clave.slice("aplicar_".length));
    const cantidad = Number(String(valor).trim());
    if (cargoId && Number.isFinite(cantidad) && cantidad > 0) manual.set(cargoId, centavos(cantidad));
  }

  type Resultado = { error: string; sinCaja?: boolean } | { folio: string; pagoId: number; aplicado: number; cambio: number; aFavor: number; cargos: number };
  let resultado: Resultado;
  try {
    resultado = await conCandado(async (tx): Promise<Resultado> => {
      // Todo cobro entra al turno de caja abierto de quien cobra.
      const turno = await turnoAbierto(sesion.usuarioId, tx);
      if (!turno) return { error: "Abre tu caja (menu Caja) para registrar cobros: cada cobro entra a tu corte.", sinCaja: true };
      // La cuenta al dia en que se recibio el dinero: recargos a esa fecha y
      // saldo a favor ya aplicado.
      await cuentaAlDia(alumnoId, tx, fechaPago);
      if (claveCaptura && (await tx.pago.findUnique({ where: { claveCaptura } }))) {
        return { error: "Ese pago ya estaba registrado; no se duplico." };
      }
      const cargos = await tx.cargo.findMany({
        where: { alumnoId, estado: { in: ["PENDIENTE", "PARCIAL", "VENCIDO"] }, saldo: { gt: 0 } },
        orderBy: [{ fechaVencimiento: "asc" }, { id: "asc" }],
      });
      if (cargos.length === 0 && efectivo) return { error: "Este alumno no tiene cargos pendientes: en efectivo no hay nada que cobrar." };

      const reparto: { cargoId: number; monto: number }[] = [];
      let restante = monto;
      if (manual.size > 0) {
        const sumaManual = centavos([...manual.values()].reduce((a, b) => a + b, 0));
        if (sumaManual > monto) return { error: `El reparto suma ${sumaManual} y el pago es de ${monto}.` };
        for (const [cargoId, cantidad] of manual.entries()) {
          const cargo = cargos.find((c) => c.id === cargoId);
          if (!cargo) return { error: "Uno de los cargos elegidos ya no esta pendiente." };
          const saldo = aNumero(cargo.saldo);
          if (cantidad > saldo) return { error: `${cargo.descripcion}: quieres aplicar ${cantidad} y el saldo es ${saldo} (ya con recargos al dia).` };
          if (!permiteParciales && cantidad !== saldo) return { error: "El colegio no permite pagos parciales: cubre el saldo completo del cargo." };
          reparto.push({ cargoId, monto: cantidad });
          restante = centavos(restante - cantidad);
        }
      }
      // Lo que sobre se aplica del cargo mas viejo al mas nuevo.
      for (const cargo of cargos) {
        if (restante <= 0) break;
        if (manual.has(cargo.id)) continue;
        const saldo = aNumero(cargo.saldo);
        const aplicar = Math.min(saldo, restante);
        if (!permiteParciales && aplicar < saldo) break;
        reparto.push({ cargoId: cargo.id, monto: centavos(aplicar) });
        restante = centavos(restante - aplicar);
      }

      const aplicado = centavos(reparto.reduce((suma, fila) => suma + fila.monto, 0));
      const sobrante = centavos(monto - aplicado);
      if (efectivo && aplicado <= 0) {
        return { error: permiteParciales ? "No se pudo aplicar el pago a ningun cargo." : "El colegio no permite pagos parciales y el efectivo no alcanza para cubrir un cargo completo." };
      }
      // En efectivo el sobrante es cambio; en lo demas, saldo a favor.
      const montoTotal = efectivo ? aplicado : monto;
      const momento = new Date();

      const creado = await tx.pago.create({
        data: {
          folio: await siguienteFolioPago(tx),
          alumnoId,
          fecha: fechaPago,
          montoTotal,
          metodoPago,
          referencia: referencia || null,
          banco: String(formData.get("banco") ?? "").trim() || null,
          estado: "CONFIRMADO",
          registradoPor: sesion.usuarioId,
          notas: String(formData.get("notas") ?? "").trim() || null,
          claveCaptura,
          efectivoRecibido: efectivo && sobrante > 0 ? monto : null,
          turnoId: turno.id,
          registradoEn: momento,
        },
      });
      for (const fila of reparto) {
        await tx.aplicacionPago.create({ data: { pagoId: creado.id, cargoId: fila.cargoId, monto: fila.monto, aplicadaEn: momento } });
      }
      const recibosPrevios = await tx.recibo.count({ where: { serie } });
      await tx.recibo.create({
        data: {
          pagoId: creado.id,
          serie,
          folio: String(folioInicial + recibosPrevios),
          fechaEmision: momento,
          subtotal: montoTotal,
          impuestos: 0,
          total: montoTotal,
          estadoCfdi: "NO_APLICA",
        },
      });
      for (const fila of reparto) await recalcularCargo(fila.cargoId, tx);
      await actualizarBanderaAdeudo(alumnoId, tx);
      return {
        folio: creado.folio,
        pagoId: creado.id,
        aplicado,
        cambio: efectivo ? sobrante : 0,
        aFavor: efectivo ? 0 : sobrante,
        cargos: reparto.length,
      };
    });
  } catch (e) {
    // Dos envios simultaneos del mismo formulario: el segundo choca con la
    // clave de captura.
    if (claveCaptura && (await db.pago.findUnique({ where: { claveCaptura } }))) {
      return { ok: true, mensaje: "Ese pago ya estaba registrado; no se duplico." };
    }
    throw e;
  }
  if ("error" in resultado) return { error: resultado.error, sinCaja: resultado.sinCaja };

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "Pago",
    entidadId: resultado.pagoId,
    datosDespues: { monto, aplicado: resultado.aplicado, metodoPago, fecha: fechaTexto, cambio: resultado.cambio, aFavor: resultado.aFavor, cargos: resultado.cargos },
    descripcion: `Pago ${resultado.folio} por ${monto} (${metodoPago.toLowerCase()}) aplicado a ${resultado.cargos} cargo(s)${resultado.aFavor > 0 ? `, ${resultado.aFavor} a favor` : ""}${resultado.cambio > 0 ? `, cambio ${resultado.cambio}` : ""}`,
  });

  revalidatePath(`/panel/finanzas/alumno/${alumnoId}`);
  revalidatePath("/panel/caja");
  const partes = [`Pago ${resultado.folio} registrado por ${dinero(resultado.aplicado + resultado.aFavor)}${resultado.cargos > 0 ? ` en ${resultado.cargos} cargo(s)` : ""}.`];
  if (resultado.cambio > 0) partes.push(`Entrega de cambio: ${dinero(resultado.cambio)}.`);
  if (resultado.aFavor > 0) partes.push(`Quedan ${dinero(resultado.aFavor)} como saldo a favor del alumno; se aplicaran solos a sus siguientes cargos.`);
  return { ok: true, mensaje: partes.join(" "), pagoId: resultado.pagoId };
}

