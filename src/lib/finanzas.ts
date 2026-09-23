import type { Periodicidad, TipoCalculo } from "@prisma/client";
import { db } from "./db";
import { configTexto } from "./configuracion";
import { resolverPlantilla } from "./formato";

/// El dinero se maneja siempre con dos decimales.
export function centavos(valor: number): number {
  return Math.round((Number.isFinite(valor) ? valor : 0) * 100) / 100;
}

export function aNumero(valor: unknown): number {
  if (valor == null) return 0;
  const numero = Number(valor.toString());
  return Number.isFinite(numero) ? numero : 0;
}

/// Cuantos meses avanza cada cargo segun la periodicidad.
function pasoEnMeses(periodicidad: Periodicidad): number {
  switch (periodicidad) {
    case "MENSUAL":
      return 1;
    case "BIMESTRAL":
      return 2;
    case "SEMESTRAL":
      return 6;
    case "ANUAL":
      return 12;
    default:
      return 0;
  }
}

/// Mueve una fecha N meses y la deja en el dia pedido, sin desbordar el mes
/// (si se pide el 31 en un mes de 30, cae el 30).
export function conDiaDelMes(base: Date, meses: number, dia?: number | null): Date {
  const fecha = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const diaFinal = dia ? Math.min(dia, ultimoDia) : Math.min(base.getUTCDate(), ultimoDia);
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), diaFinal));
}

export function mesesEntre(inicio: Date, fin: Date): number {
  return (
    (fin.getUTCFullYear() - inicio.getUTCFullYear()) * 12 +
    (fin.getUTCMonth() - inicio.getUTCMonth()) +
    1
  );
}

export type ConceptoParaFechas = {
  periodicidad: Periodicidad;
  diaVencimiento: number | null;
  fechaPrimerCargo: Date | null;
  numeroCargos: number | null;
};

export type CicloParaFechas = {
  fechaInicio: Date;
  fechaFin: Date;
  /// Fechas de inicio de los periodos de evaluacion, para la periodicidad
  /// "por periodo academico".
  periodos?: { fechaInicio: Date }[];
};

/// Calcula cuando vence cada cargo de un concepto. Todo sale de lo que el
/// colegio configuro: fecha del primer cargo, dia de vencimiento, cuantos
/// cargos y cada cuanto.
export function fechasDeVencimiento(
  concepto: ConceptoParaFechas,
  ciclo: CicloParaFechas,
  duracionPlanEnPeriodos?: number | null
): Date[] {
  const inicio = concepto.fechaPrimerCargo ?? ciclo.fechaInicio;

  if (concepto.periodicidad === "UNICO") {
    return [conDiaDelMes(inicio, 0, concepto.diaVencimiento)];
  }

  if (concepto.periodicidad === "POR_PERIODO_ACADEMICO") {
    const periodos = ciclo.periodos ?? [];
    const cuantos = concepto.numeroCargos ?? periodos.length ?? duracionPlanEnPeriodos ?? 0;
    if (periodos.length > 0) {
      return periodos
        .slice(0, cuantos || periodos.length)
        .map((periodo) => conDiaDelMes(periodo.fechaInicio, 0, concepto.diaVencimiento));
    }
    // Sin periodos definidos se reparte el ciclo en partes iguales.
    const total = cuantos || duracionPlanEnPeriodos || 1;
    const meses = Math.max(1, Math.floor(mesesEntre(ciclo.fechaInicio, ciclo.fechaFin) / total));
    return Array.from({ length: total }, (_, indice) =>
      conDiaDelMes(inicio, indice * meses, concepto.diaVencimiento)
    );
  }

  const paso = pasoEnMeses(concepto.periodicidad);
  const disponibles = Math.max(1, Math.ceil(mesesEntre(inicio, ciclo.fechaFin) / Math.max(1, paso)));
  const cuantos = concepto.numeroCargos ?? disponibles;

  return Array.from({ length: Math.max(0, cuantos) }, (_, indice) =>
    conDiaDelMes(inicio, indice * paso, concepto.diaVencimiento)
  );
}

export type DescuentoAplicable = {
  nombre: string;
  tipoCalculo: TipoCalculo;
  valor: number;
};

/// Aplica becas y descuentos sobre el monto de un cargo. Si la escuela no
/// permite acumularlos se aplica solo el mas favorable al alumno.
export function calcularDescuento(
  monto: number,
  descuentos: DescuentoAplicable[],
  acumulables: boolean
): { total: number; detalle: string[] } {
  if (descuentos.length === 0 || monto <= 0) return { total: 0, detalle: [] };

  const calculados = descuentos.map((descuento) => ({
    nombre: descuento.nombre,
    monto:
      descuento.tipoCalculo === "PORCENTAJE"
        ? centavos((monto * descuento.valor) / 100)
        : centavos(Math.min(descuento.valor, monto)),
  }));

  if (!acumulables) {
    const mejor = calculados.reduce((a, b) => (b.monto > a.monto ? b : a));
    return { total: Math.min(mejor.monto, monto), detalle: [mejor.nombre] };
  }

  const suma = calculados.reduce((total, actual) => total + actual.monto, 0);
  return {
    total: Math.min(centavos(suma), monto),
    detalle: calculados.map((c) => c.nombre),
  };
}

export type ReglaRecargoAplicable = {
  nombre: string;
  tipoCalculo: TipoCalculo;
  valor: number;
  diasGracia: number;
  frecuencia: "UNICA" | "DIARIA" | "SEMANAL" | "MENSUAL";
  topeMaximo: number | null;
};

/// Recargo por pago tardio sobre el saldo vencido. Devuelve 0 mientras el
/// cargo este dentro de los dias de gracia.
export function calcularRecargo(
  base: number,
  fechaVencimiento: Date,
  regla: ReglaRecargoAplicable,
  hoy: Date = new Date()
): number {
  if (base <= 0) return 0;

  const limite = new Date(fechaVencimiento);
  limite.setUTCDate(limite.getUTCDate() + regla.diasGracia);
  if (hoy <= limite) return 0;

  const diasDeAtraso = Math.floor((hoy.getTime() - limite.getTime()) / 86_400_000);
  let veces = 1;
  if (regla.frecuencia === "DIARIA") veces = Math.max(1, diasDeAtraso);
  if (regla.frecuencia === "SEMANAL") veces = Math.max(1, Math.ceil(diasDeAtraso / 7));
  if (regla.frecuencia === "MENSUAL") veces = Math.max(1, Math.ceil(diasDeAtraso / 30));

  const unitario =
    regla.tipoCalculo === "PORCENTAJE" ? centavos((base * regla.valor) / 100) : centavos(regla.valor);
  const total = centavos(unitario * veces);

  return regla.topeMaximo != null ? Math.min(total, regla.topeMaximo) : total;
}

/// Folio consecutivo con la plantilla que la escuela configuro.
export async function siguienteFolioCargo(): Promise<string> {
  const plantilla = await configTexto("finanzas.plantilla_folio_cargo", "C-{ANIO}-{CONSECUTIVO:6}");
  const total = await db.cargo.count();
  return unicoFolio(plantilla, total, async (folio) =>
    Boolean(await db.cargo.findUnique({ where: { folio } }))
  );
}

export async function siguienteFolioPago(): Promise<string> {
  const plantilla = await configTexto("finanzas.plantilla_folio_pago", "P-{ANIO}-{CONSECUTIVO:6}");
  const total = await db.pago.count();
  return unicoFolio(plantilla, total, async (folio) =>
    Boolean(await db.pago.findUnique({ where: { folio } }))
  );
}

async function unicoFolio(
  plantilla: string,
  base: number,
  existe: (folio: string) => Promise<boolean>
): Promise<string> {
  for (let intento = 1; intento <= 500; intento++) {
    const candidato = resolverPlantilla(plantilla, { consecutivo: base + intento });
    if (!(await existe(candidato))) return candidato;
  }
  return `${Date.now()}`;
}

export type ResumenCuenta = {
  totalCargado: number;
  totalPagado: number;
  saldo: number;
  vencido: number;
  cargosPendientes: number;
  cargosVencidos: number;
};

/// Resumen del estado de cuenta de un alumno.
export async function resumenDeCuenta(alumnoId: number): Promise<ResumenCuenta> {
  const cargos = await db.cargo.findMany({
    where: { alumnoId, estado: { notIn: ["CANCELADO", "CONDONADO"] } },
  });
  const hoy = new Date();

  let totalCargado = 0;
  let saldo = 0;
  let vencido = 0;
  let cargosPendientes = 0;
  let cargosVencidos = 0;

  for (const cargo of cargos) {
    const total = aNumero(cargo.montoTotal);
    const pendiente = aNumero(cargo.saldo);
    totalCargado += total;
    saldo += pendiente;
    if (pendiente > 0) {
      cargosPendientes++;
      if (cargo.fechaVencimiento < hoy) {
        vencido += pendiente;
        cargosVencidos++;
      }
    }
  }

  return {
    totalCargado: centavos(totalCargado),
    totalPagado: centavos(totalCargado - saldo),
    saldo: centavos(saldo),
    vencido: centavos(vencido),
    cargosPendientes,
    cargosVencidos,
  };
}

/// Marca en el alumno si trae adeudo vencido, para el bloqueo configurable.
export async function actualizarBanderaAdeudo(alumnoId: number): Promise<boolean> {
  const resumen = await resumenDeCuenta(alumnoId);
  const tieneAdeudo = resumen.vencido > 0;
  await db.alumno.update({ where: { id: alumnoId }, data: { tieneAdeudo } });
  return tieneAdeudo;
}
