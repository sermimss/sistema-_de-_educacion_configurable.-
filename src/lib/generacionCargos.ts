import type { AmbitoAplicacion } from "@prisma/client";
import { db } from "./db";
import { configBool } from "./configuracion";
import {
  actualizarBanderaAdeudo,
  aNumero,
  calcularDescuento,
  calcularRecargo,
  centavos,
  fechasDeVencimiento,
  siguienteFolioCargo,
} from "./finanzas";

export type LineaPrevia = {
  alumnoId: number;
  matricula: string;
  alumno: string;
  conceptoId: number;
  motivo: string;
  fechaVencimiento: Date;
  montoOriginal: number;
  montoDescuento: number;
  montoTotal: number;
  descuentos: string[];
  yaExiste: boolean;
};

export type ResultadoGeneracion = {
  lineas: LineaPrevia[];
  creados: number;
  omitidos: number;
  montoTotal: number;
};

type FiltroGeneracion = {
  cicloId: number;
  grupoId?: number | null;
  alumnoId?: number | null;
};

/// Decide si un concepto aplica a un alumno concreto segun su ambito.
function conceptoAplica(
  ambito: AmbitoAplicacion,
  referenciaId: number | null,
  contexto: { alumnoId: number; planId: number; nivelId: number; gradoId: number; grupoId: number }
): boolean {
  switch (ambito) {
    case "TODOS":
      return true;
    case "NIVEL":
      return referenciaId === contexto.nivelId;
    case "PLAN":
      return referenciaId === contexto.planId;
    case "GRADO":
      return referenciaId === contexto.gradoId;
    case "GRUPO":
      return referenciaId === contexto.grupoId;
    case "ALUMNO":
      return referenciaId === contexto.alumnoId;
    default:
      return false;
  }
}

/// Calcula (y opcionalmente crea) los cargos del ciclo. Es idempotente: un
/// cargo ya existente para el mismo alumno, concepto y fecha no se duplica,
/// asi que se puede correr las veces que haga falta.
export async function generarCargos(
  filtro: FiltroGeneracion,
  opciones: { soloVistaPrevia: boolean; creadoPor?: number }
): Promise<ResultadoGeneracion> {
  const ciclo = await db.cicloEscolar.findUnique({
    where: { id: filtro.cicloId },
    include: { periodos: { orderBy: { numero: "asc" } } },
  });
  if (!ciclo) return { lineas: [], creados: 0, omitidos: 0, montoTotal: 0 };

  const [conceptos, acumulables] = await Promise.all([
    db.conceptoCobro.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      include: { descuentos: { select: { id: true } } },
    }),
    configBool("finanzas.descuentos_acumulables", false),
  ]);

  const inscripciones = await db.inscripcion.findMany({
    where: {
      cicloId: filtro.cicloId,
      estado: "INSCRITO",
      ...(filtro.grupoId ? { grupoId: filtro.grupoId } : {}),
      ...(filtro.alumnoId ? { alumnoId: filtro.alumnoId } : {}),
    },
    include: {
      alumno: {
        include: {
          plan: true,
          descuentos: {
            where: { activo: true },
            include: { descuento: { include: { conceptos: { select: { id: true } } } } },
          },
        },
      },
      grupo: true,
    },
  });

  const lineas: LineaPrevia[] = [];
  let creados = 0;
  let omitidos = 0;
  let montoTotal = 0;
  const hoy = new Date();

  for (const inscripcion of inscripciones) {
    const alumno = inscripcion.alumno;
    const contexto = {
      alumnoId: alumno.id,
      planId: alumno.planId,
      nivelId: alumno.plan.nivelId,
      gradoId: inscripcion.gradoId,
      grupoId: inscripcion.grupoId,
    };

    for (const concepto of conceptos) {
      if (!conceptoAplica(concepto.ambito, concepto.referenciaId, contexto)) continue;

      const fechas = fechasDeVencimiento(
        {
          periodicidad: concepto.periodicidad,
          diaVencimiento: concepto.diaVencimiento,
          fechaPrimerCargo: concepto.fechaPrimerCargo,
          numeroCargos: concepto.numeroCargos,
        },
        ciclo,
        alumno.plan.duracionPeriodos
      );

      // Becas vigentes que aplican a este concepto.
      const aplicables = concepto.aplicaDescuentos
        ? alumno.descuentos
            .filter((asignacion) => {
              const descuento = asignacion.descuento;
              if (!descuento.activo) return false;
              if (asignacion.cicloId && asignacion.cicloId !== filtro.cicloId) return false;
              if (descuento.vigenciaInicio && descuento.vigenciaInicio > hoy) return false;
              if (descuento.vigenciaFin && descuento.vigenciaFin < hoy) return false;
              if (descuento.aplicaATodos) return true;
              return descuento.conceptos.some((relacion) => relacion.id === concepto.id);
            })
            .map((asignacion) => ({
              nombre: asignacion.descuento.nombre,
              tipoCalculo: asignacion.descuento.tipoCalculo,
              valor: aNumero(asignacion.descuento.valor),
            }))
        : [];

      const montoBase = aNumero(concepto.montoBase);
      const descuento = calcularDescuento(montoBase, aplicables, acumulables);
      const total = centavos(montoBase - descuento.total);
      const motivoBase = concepto.leyenda || concepto.nombre;

      for (const [indice, fechaVencimiento] of fechas.entries()) {
        const existente = await db.cargo.findFirst({
          where: {
            alumnoId: alumno.id,
            conceptoId: concepto.id,
            cicloId: filtro.cicloId,
            fechaVencimiento,
          },
        });

        const motivo =
          fechas.length > 1 ? `${motivoBase} (${indice + 1}/${fechas.length})` : motivoBase;

        lineas.push({
          alumnoId: alumno.id,
          matricula: alumno.matricula,
          alumno: `${alumno.apellidoPaterno} ${alumno.nombres}`,
          conceptoId: concepto.id,
          motivo,
          fechaVencimiento,
          montoOriginal: montoBase,
          montoDescuento: descuento.total,
          montoTotal: total,
          descuentos: descuento.detalle,
          yaExiste: Boolean(existente),
        });

        if (existente) {
          omitidos++;
          continue;
        }

        montoTotal += total;

        if (!opciones.soloVistaPrevia) {
          await db.cargo.create({
            data: {
              folio: await siguienteFolioCargo(),
              alumnoId: alumno.id,
              conceptoId: concepto.id,
              cicloId: filtro.cicloId,
              descripcion: motivo,
              montoOriginal: montoBase,
              montoDescuento: descuento.total,
              montoRecargo: 0,
              montoTotal: total,
              saldo: total,
              fechaVencimiento,
              estado: "PENDIENTE",
              generadoAutomatico: true,
              creadoPor: opciones.creadoPor,
            },
          });
          creados++;
        } else {
          creados++;
        }
      }
    }
  }

  if (!opciones.soloVistaPrevia) {
    const alumnosTocados = [...new Set(lineas.map((linea) => linea.alumnoId))];
    for (const alumnoId of alumnosTocados) await actualizarBanderaAdeudo(alumnoId);
  }

  return { lineas, creados, omitidos, montoTotal: centavos(montoTotal) };
}

/// Recalcula montos, saldo y estado de un cargo a partir de lo que ya se le
/// aplico en pagos. Se usa tras cobrar, cancelar un pago o mover recargos.
export async function recalcularCargo(cargoId: number): Promise<void> {
  const cargo = await db.cargo.findUnique({
    where: { id: cargoId },
    include: { aplicaciones: { include: { pago: true } } },
  });
  if (!cargo) return;
  if (cargo.estado === "CANCELADO" || cargo.estado === "CONDONADO") return;

  const pagado = centavos(
    cargo.aplicaciones
      .filter((aplicacion) => aplicacion.pago.estado !== "CANCELADO")
      .reduce((suma, aplicacion) => suma + aNumero(aplicacion.monto), 0)
  );

  const total = centavos(
    aNumero(cargo.montoOriginal) - aNumero(cargo.montoDescuento) + aNumero(cargo.montoRecargo)
  );
  const saldo = centavos(Math.max(0, total - pagado));
  const vencido = cargo.fechaVencimiento < new Date();

  const estado =
    saldo <= 0 ? "PAGADO" : pagado > 0 ? "PARCIAL" : vencido ? "VENCIDO" : "PENDIENTE";

  await db.cargo.update({
    where: { id: cargoId },
    data: { montoTotal: total, saldo, estado },
  });
}

export type ResumenRecargos = {
  revisados: number;
  actualizados: number;
  montoAgregado: number;
};

/// Aplica las reglas de recargo a los cargos vencidos. Recalcula desde cero,
/// asi que correrlo dos veces no cobra el recargo dos veces.
export async function actualizarRecargos(cicloId?: number | null): Promise<ResumenRecargos> {
  const reglas = await db.reglaRecargo.findMany({
    where: { activa: true },
    include: { conceptos: { select: { id: true } } },
  });
  if (reglas.length === 0) return { revisados: 0, actualizados: 0, montoAgregado: 0 };

  const cargos = await db.cargo.findMany({
    where: {
      estado: { in: ["PENDIENTE", "PARCIAL", "VENCIDO"] },
      ...(cicloId ? { cicloId } : {}),
    },
    include: { concepto: true, aplicaciones: { include: { pago: true } } },
  });

  const hoy = new Date();
  let actualizados = 0;
  let montoAgregado = 0;

  for (const cargo of cargos) {
    // Un cargo manual lleva recargo solo si no esta ligado a un concepto que
    // lo tenga apagado.
    if (cargo.concepto && !cargo.concepto.generaRecargo) continue;

    const reglaAplicable = reglas.find(
      (regla) =>
        regla.aplicaATodos ||
        (cargo.conceptoId != null &&
          regla.conceptos.some((relacion) => relacion.id === cargo.conceptoId))
    );
    if (!reglaAplicable) continue;

    const pagado = centavos(
      cargo.aplicaciones
        .filter((aplicacion) => aplicacion.pago.estado !== "CANCELADO")
        .reduce((suma, aplicacion) => suma + aNumero(aplicacion.monto), 0)
    );
    const baseSinRecargo = centavos(
      aNumero(cargo.montoOriginal) - aNumero(cargo.montoDescuento) - pagado
    );

    const recargo = calcularRecargo(
      Math.max(0, baseSinRecargo),
      cargo.fechaVencimiento,
      {
        nombre: reglaAplicable.nombre,
        tipoCalculo: reglaAplicable.tipoCalculo,
        valor: aNumero(reglaAplicable.valor),
        diasGracia: reglaAplicable.diasGracia,
        frecuencia: reglaAplicable.frecuencia,
        topeMaximo: reglaAplicable.topeMaximo != null ? aNumero(reglaAplicable.topeMaximo) : null,
      },
      hoy
    );

    const anterior = aNumero(cargo.montoRecargo);
    if (centavos(recargo) === anterior) continue;

    montoAgregado += centavos(recargo) - anterior;
    await db.cargo.update({ where: { id: cargo.id }, data: { montoRecargo: centavos(recargo) } });
    await recalcularCargo(cargo.id);
    actualizados++;
  }

  const alumnos = [...new Set(cargos.map((cargo) => cargo.alumnoId))];
  for (const alumnoId of alumnos) await actualizarBanderaAdeudo(alumnoId);

  return { revisados: cargos.length, actualizados, montoAgregado: centavos(montoAgregado) };
}
