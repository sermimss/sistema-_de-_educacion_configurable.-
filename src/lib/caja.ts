import type { MetodoPago, Prisma } from "@prisma/client";
import { db } from "./db";
import { aNumero, centavos, type ClienteFinanzas } from "./finanzas";

/// Caja por cajero: cada persona abre su turno con un fondo de efectivo, todo
/// lo que cobra queda en su turno y al cerrar cuenta el efectivo (corte).

export async function turnoAbierto(usuarioId: number, cliente: ClienteFinanzas = db) {
  return cliente.turnoCaja.findFirst({ where: { usuarioId, estado: "ABIERTO" }, orderBy: { id: "desc" } });
}

export const NOMBRE_METODO: Record<MetodoPago, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA_CREDITO: "Tarjeta de credito",
  TARJETA_DEBITO: "Tarjeta de debito",
  CHEQUE: "Cheque",
  DEPOSITO: "Deposito",
  PAGO_EN_LINEA: "Pago en linea",
  OTRO: "Otro",
};

export type ResumenTurno = {
  porMetodo: { metodo: MetodoPago; cobros: number; total: number }[];
  totalCobrado: number;
  cobros: number;
  cancelados: number;
  montoCancelado: number;
  efectivoCobrado: number;
  efectivoEsperado: number;
};

/// Totales del turno. Lo cancelado no cuenta (el dinero se devolvio) y el
/// efectivo esperado es el fondo mas lo cobrado en efectivo (ya sin cambio).
export async function resumenTurno(turnoId: number, cliente: ClienteFinanzas = db): Promise<ResumenTurno> {
  const turno = await cliente.turnoCaja.findUniqueOrThrow({
    where: { id: turnoId },
    include: { pagos: { select: { metodoPago: true, montoTotal: true, estado: true } } },
  });
  const vigentes = turno.pagos.filter((p) => p.estado !== "CANCELADO");
  const cancelados = turno.pagos.filter((p) => p.estado === "CANCELADO");
  const mapa = new Map<MetodoPago, { cobros: number; total: number }>();
  for (const p of vigentes) {
    const fila = mapa.get(p.metodoPago) ?? { cobros: 0, total: 0 };
    fila.cobros += 1;
    fila.total = centavos(fila.total + aNumero(p.montoTotal));
    mapa.set(p.metodoPago, fila);
  }
  const porMetodo = (Object.keys(NOMBRE_METODO) as MetodoPago[])
    .filter((m) => mapa.has(m))
    .map((metodo) => ({ metodo, ...mapa.get(metodo)! }));
  const efectivoCobrado = mapa.get("EFECTIVO")?.total ?? 0;
  return {
    porMetodo,
    totalCobrado: centavos(porMetodo.reduce((s, f) => s + f.total, 0)),
    cobros: vigentes.length,
    cancelados: cancelados.length,
    montoCancelado: centavos(cancelados.reduce((s, p) => s + aNumero(p.montoTotal), 0)),
    efectivoCobrado,
    efectivoEsperado: centavos(aNumero(turno.fondoInicial) + efectivoCobrado),
  };
}

export async function abrirTurno(tx: Prisma.TransactionClient, usuario: { id: number; nombre: string }, fondoInicial: number) {
  const abierto = await turnoAbierto(usuario.id, tx);
  if (abierto) return { turno: abierto, yaEstaba: true };
  const turno = await tx.turnoCaja.create({ data: { usuarioId: usuario.id, usuarioNombre: usuario.nombre, fondoInicial } });
  return { turno, yaEstaba: false };
}
