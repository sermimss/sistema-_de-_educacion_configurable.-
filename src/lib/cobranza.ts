import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { configBool } from "./configuracion";
import { actualizarBanderaAdeudo, aNumero, centavos, type ClienteFinanzas } from "./finanzas";
import { actualizarRecargos, recalcularCargo } from "./generacionCargos";

/// Reglas para que el cobro sea confiable:
/// - Todo cobro, cancelacion o revision de recargos corre con la "caja"
///   bloqueada (un candado de PostgreSQL por colegio): dos personas cobrando
///   al mismo tiempo no sacan el mismo folio ni cobran dos veces el mismo
///   saldo.
/// - Antes de cobrar se calculan los recargos al dia de hoy.
/// - Lo que un pago no alcanza a aplicar es saldo a favor del alumno y se
///   aplica solo a sus cargos pendientes, del mas viejo al mas nuevo.

export { REQUIEREN_REFERENCIA, requiereReferencia } from "./referenciasPago";

/// Corre la operacion en una transaccion con la caja del colegio bloqueada.
export async function conCandado<T>(operacion: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(
    async (tx) => {
      // Una llave por esquema: en la plataforma cada colegio tiene su caja.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('cobranza:' || current_schema()))`;
      return operacion(tx);
    },
    { timeout: 60_000, maxWait: 30_000 }
  );
}

/// Saldo a favor: lo pagado (pagos vigentes) que no se ha aplicado a cargos.
export async function saldoAFavor(alumnoId: number, cliente: ClienteFinanzas = db): Promise<number> {
  const pagos = await cliente.pago.findMany({
    where: { alumnoId, estado: { not: "CANCELADO" } },
    select: { montoTotal: true, aplicaciones: { select: { monto: true } } },
  });
  return centavos(
    pagos.reduce((suma, p) => suma + aNumero(p.montoTotal) - p.aplicaciones.reduce((s, a) => s + aNumero(a.monto), 0), 0)
  );
}

/// Aplica el saldo a favor a los cargos pendientes (del mas viejo al mas
/// nuevo, usando primero el dinero mas antiguo). Respeta "pagos parciales":
/// si no se permiten, solo cubre cargos completos. Devuelve lo aplicado.
export async function aplicarSaldoAFavor(alumnoId: number, cliente: ClienteFinanzas = db): Promise<number> {
  const pagos = await cliente.pago.findMany({
    where: { alumnoId, estado: { not: "CANCELADO" } },
    orderBy: [{ fecha: "asc" }, { id: "asc" }],
    select: { id: true, montoTotal: true, aplicaciones: { select: { monto: true } } },
  });
  const conSaldo = pagos
    .map((p) => ({ id: p.id, libre: centavos(aNumero(p.montoTotal) - p.aplicaciones.reduce((s, a) => s + aNumero(a.monto), 0)) }))
    .filter((p) => p.libre > 0);
  if (conSaldo.length === 0) return 0;

  const permiteParciales = await configBool("finanzas.permite_pagos_parciales", true);
  const cargos = await cliente.cargo.findMany({
    where: { alumnoId, estado: { in: ["PENDIENTE", "PARCIAL", "VENCIDO"] }, saldo: { gt: 0 } },
    orderBy: [{ fechaVencimiento: "asc" }, { id: "asc" }],
  });
  const momento = new Date();
  let aplicado = 0;
  const tocados = new Set<number>();
  for (const cargo of cargos) {
    let saldo = aNumero(cargo.saldo);
    const disponible = centavos(conSaldo.reduce((s, p) => s + p.libre, 0));
    if (disponible <= 0) break;
    if (!permiteParciales && disponible < saldo) break;
    for (const pago of conSaldo) {
      if (saldo <= 0) break;
      if (pago.libre <= 0) continue;
      const monto = centavos(Math.min(pago.libre, saldo));
      const existente = await cliente.aplicacionPago.findUnique({ where: { pagoId_cargoId: { pagoId: pago.id, cargoId: cargo.id } } });
      if (existente) {
        await cliente.aplicacionPago.update({ where: { id: existente.id }, data: { monto: centavos(aNumero(existente.monto) + monto), aplicadaEn: momento } });
      } else {
        await cliente.aplicacionPago.create({ data: { pagoId: pago.id, cargoId: cargo.id, monto, aplicadaEn: momento } });
      }
      pago.libre = centavos(pago.libre - monto);
      saldo = centavos(saldo - monto);
      aplicado = centavos(aplicado + monto);
      tocados.add(cargo.id);
    }
  }
  for (const cargoId of tocados) await recalcularCargo(cargoId, cliente);
  return aplicado;
}

/// Deja la cuenta del alumno al dia antes de mostrarla o cobrar: recargos de
/// hoy (o de la fecha en que se recibio un pago), estado de cada cargo segun su fecha, saldo a favor aplicado y la
/// marca de adeudo.
export async function cuentaAlDia(alumnoId: number, tx: Prisma.TransactionClient, alFecha?: Date) {
  await actualizarRecargos({ alumnoId, alFecha }, tx);
  const pendientes = await tx.cargo.findMany({
    where: { alumnoId, estado: { in: ["PENDIENTE", "PARCIAL", "VENCIDO"] } },
    select: { id: true },
  });
  for (const c of pendientes) await recalcularCargo(c.id, tx);
  await aplicarSaldoAFavor(alumnoId, tx);
  await actualizarBanderaAdeudo(alumnoId, tx);
}

export async function prepararCuenta(alumnoId: number) {
  await conCandado((tx) => cuentaAlDia(alumnoId, tx));
}

/// Cargos vencidos por fecha, no por la marca guardada: un cargo que vencio
/// hoy cuenta aunque nadie haya cobrado ni generado nada.
export function condicionAdeudoVencido(ahora = new Date()): Prisma.CargoWhereInput {
  return { estado: { in: ["PENDIENTE", "PARCIAL", "VENCIDO"] }, saldo: { gt: 0 }, fechaVencimiento: { lt: ahora } };
}

export async function alumnosConAdeudoVencido(alumnoIds: number[]): Promise<Set<number>> {
  if (alumnoIds.length === 0) return new Set();
  const filas = await db.cargo.findMany({
    where: { alumnoId: { in: alumnoIds }, ...condicionAdeudoVencido() },
    select: { alumnoId: true },
    distinct: ["alumnoId"],
  });
  return new Set(filas.map((f) => f.alumnoId));
}

/// Estado que se muestra: un cargo pendiente cuya fecha ya paso es vencido.
export function estadoVisible(cargo: { estado: string; fechaVencimiento: Date; saldo: unknown }, ahora = new Date()): string {
  if (cargo.estado === "PENDIENTE" && cargo.fechaVencimiento < ahora && aNumero(cargo.saldo) > 0) return "VENCIDO";
  return cargo.estado;
}
