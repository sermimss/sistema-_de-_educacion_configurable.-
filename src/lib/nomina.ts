import type { TipoCalculo, TipoConceptoNomina } from "@prisma/client";
import { db } from "./db";
import { configBool, configNumero, configTexto } from "./configuracion";
import { centavos, aNumero } from "./finanzas";
import { resolverPlantilla } from "./formato";

/// Dias que cubre un periodo de nomina, contando ambos extremos.
export function diasDelPeriodo(inicio: Date, fin: Date): number {
  const dias = Math.floor((fin.getTime() - inicio.getTime()) / 86_400_000) + 1;
  return Math.max(1, dias);
}

export type EmpleadoParaNomina = {
  id: number;
  salarioBase: number | null;
  pagoPorHora: number | null;
};

export type ConceptoParaNomina = {
  id: number;
  clave: string;
  nombre: string;
  tipo: TipoConceptoNomina;
  tipoCalculo: TipoCalculo;
  valor: number | null;
  gravable: boolean;
};

export type LineaCalculada = {
  conceptoId: number;
  nombre: string;
  tipo: TipoConceptoNomina;
  cantidad: number | null;
  importe: number;
  manual: boolean;
};

export type ReciboCalculado = {
  lineas: LineaCalculada[];
  totalPercepciones: number;
  totalDeducciones: number;
  neto: number;
  sueldoDelPeriodo: number;
};

/// Calcula el recibo de un empleado para un periodo.
///
/// El sueldo del periodo sale del salario base: se saca el sueldo diario
/// dividiendo entre los "dias base del mes" que configuro el colegio y se
/// multiplica por los dias que cubre el periodo. Si el colegio apaga el
/// prorrateo, cada periodo paga el salario base completo.
///
/// Los conceptos con calculo por porcentaje se aplican sobre ese sueldo del
/// periodo. El sistema no calcula tablas oficiales de ISR ni de seguridad
/// social: cada escuela captura sus propios porcentajes o montos.
export function calcularRecibo(
  empleado: EmpleadoParaNomina,
  conceptos: ConceptoParaNomina[],
  opciones: {
    diasDelPeriodo: number;
    diasBaseMes: number;
    prorratea: boolean;
    /// Lineas capturadas a mano para este recibo (bonos, prestamos, horas).
    ajustes?: { conceptoId: number; cantidad: number | null; importe: number }[];
  }
): ReciboCalculado {
  const salario = empleado.salarioBase ?? 0;
  const sueldoDelPeriodo = opciones.prorratea
    ? centavos((salario / Math.max(1, opciones.diasBaseMes)) * opciones.diasDelPeriodo)
    : centavos(salario);

  const lineas: LineaCalculada[] = [];

  for (const concepto of conceptos) {
    const valor = concepto.valor ?? 0;
    if (valor === 0) continue;

    const importe =
      concepto.tipoCalculo === "PORCENTAJE"
        ? centavos((sueldoDelPeriodo * valor) / 100)
        : centavos(valor);
    if (importe === 0) continue;

    lineas.push({
      conceptoId: concepto.id,
      nombre: concepto.nombre,
      tipo: concepto.tipo,
      cantidad: concepto.tipoCalculo === "PORCENTAJE" ? valor : null,
      importe,
      manual: false,
    });
  }

  for (const ajuste of opciones.ajustes ?? []) {
    const concepto = conceptos.find((c) => c.id === ajuste.conceptoId);
    if (!concepto) continue;
    lineas.push({
      conceptoId: concepto.id,
      nombre: concepto.nombre,
      tipo: concepto.tipo,
      cantidad: ajuste.cantidad,
      importe: centavos(ajuste.importe),
      manual: true,
    });
  }

  const totalPercepciones = centavos(
    sueldoDelPeriodo +
      lineas
        .filter((linea) => linea.tipo === "PERCEPCION" || linea.tipo === "OTRO_PAGO")
        .reduce((suma, linea) => suma + linea.importe, 0)
  );
  const totalDeducciones = centavos(
    lineas
      .filter((linea) => linea.tipo === "DEDUCCION")
      .reduce((suma, linea) => suma + linea.importe, 0)
  );

  return {
    lineas,
    sueldoDelPeriodo,
    totalPercepciones,
    totalDeducciones,
    neto: centavos(totalPercepciones - totalDeducciones),
  };
}

export async function siguienteFolioNomina(): Promise<string> {
  const plantilla = await configTexto("nomina.plantilla_folio_recibo", "N-{ANIO}-{CONSECUTIVO:5}");
  const total = await db.reciboNomina.count();
  for (let intento = 1; intento <= 500; intento++) {
    const candidato = resolverPlantilla(plantilla, { consecutivo: total + intento });
    const existe = await db.reciboNomina.findUnique({ where: { folio: candidato } });
    if (!existe) return candidato;
  }
  return `N-${Date.now()}`;
}

export type ResumenCalculo = {
  creados: number;
  actualizados: number;
  omitidos: number;
  totalNeto: number;
};

/// Genera o actualiza los recibos de un periodo. Los recibos ya autorizados o
/// pagados no se tocan: solo se recalculan los que siguen en borrador.
export async function calcularNominaDelPeriodo(periodoId: number): Promise<ResumenCalculo> {
  const periodo = await db.periodoNomina.findUnique({ where: { id: periodoId } });
  if (!periodo) return { creados: 0, actualizados: 0, omitidos: 0, totalNeto: 0 };

  const [empleados, conceptosBase, diasBaseMes, prorratea] = await Promise.all([
    db.empleado.findMany({ where: { estado: "ACTIVO" }, orderBy: { numeroEmpleado: "asc" } }),
    db.conceptoNomina.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    configNumero("nomina.dias_base_mes", 30),
    configBool("nomina.prorratea_por_dias", true),
  ]);

  const conceptos: ConceptoParaNomina[] = conceptosBase.map((concepto) => ({
    id: concepto.id,
    clave: concepto.clave,
    nombre: concepto.nombre,
    tipo: concepto.tipo,
    tipoCalculo: concepto.tipoCalculo,
    valor: concepto.valor != null ? aNumero(concepto.valor) : null,
    gravable: concepto.gravable,
  }));

  const dias = diasDelPeriodo(periodo.fechaInicio, periodo.fechaFin);
  let creados = 0;
  let actualizados = 0;
  let omitidos = 0;
  let totalNeto = 0;

  for (const empleado of empleados) {
    const existente = await db.reciboNomina.findUnique({
      where: { periodoId_empleadoId: { periodoId, empleadoId: empleado.id } },
      include: { detalles: true },
    });

    if (existente && existente.estado !== "BORRADOR") {
      omitidos++;
      totalNeto += aNumero(existente.neto);
      continue;
    }

    // Los ajustes capturados a mano se conservan al recalcular. Se reconocen
    // por su bandera, no por el concepto: un bono capturado a mano puede usar
    // el mismo concepto que aplica automaticamente a todos.
    const ajustes = (existente?.detalles ?? [])
      .filter((detalle) => detalle.manual)
      .map((detalle) => ({
        conceptoId: detalle.conceptoId,
        cantidad: detalle.cantidad != null ? aNumero(detalle.cantidad) : null,
        importe: aNumero(detalle.importe),
      }));

    const idsAjuste = ajustes.map((ajuste) => ajuste.conceptoId);
    const conceptosDeAjuste = idsAjuste.length
      ? (await db.conceptoNomina.findMany({ where: { id: { in: idsAjuste } } })).filter(
          (concepto) => !conceptos.some((automatico) => automatico.id === concepto.id)
        )
      : [];

    const calculo = calcularRecibo(
      {
        id: empleado.id,
        salarioBase: empleado.salarioBase != null ? aNumero(empleado.salarioBase) : null,
        pagoPorHora: empleado.pagoPorHora != null ? aNumero(empleado.pagoPorHora) : null,
      },
      [
        ...conceptos,
        ...conceptosDeAjuste.map((concepto) => ({
          id: concepto.id,
          clave: concepto.clave,
          nombre: concepto.nombre,
          tipo: concepto.tipo,
          tipoCalculo: concepto.tipoCalculo,
          valor: null,
          gravable: concepto.gravable,
        })),
      ],
      { diasDelPeriodo: dias, diasBaseMes, prorratea, ajustes }
    );

    totalNeto += calculo.neto;

    if (existente) {
      await db.$transaction(async (tx) => {
        await tx.detalleReciboNomina.deleteMany({ where: { reciboId: existente.id } });
        await tx.reciboNomina.update({
          where: { id: existente.id },
          data: {
            totalPercepciones: calculo.totalPercepciones,
            totalDeducciones: calculo.totalDeducciones,
            neto: calculo.neto,
          },
        });
        for (const linea of calculo.lineas) {
          await tx.detalleReciboNomina.create({
            data: {
              reciboId: existente.id,
              conceptoId: linea.conceptoId,
              cantidad: linea.cantidad,
              importe: linea.importe,
              manual: linea.manual,
            },
          });
        }
      });
      actualizados++;
    } else {
      const folio = await siguienteFolioNomina();
      await db.$transaction(async (tx) => {
        const recibo = await tx.reciboNomina.create({
          data: {
            folio,
            periodoId,
            empleadoId: empleado.id,
            totalPercepciones: calculo.totalPercepciones,
            totalDeducciones: calculo.totalDeducciones,
            neto: calculo.neto,
            estado: "BORRADOR",
          },
        });
        for (const linea of calculo.lineas) {
          await tx.detalleReciboNomina.create({
            data: {
              reciboId: recibo.id,
              conceptoId: linea.conceptoId,
              cantidad: linea.cantidad,
              importe: linea.importe,
              manual: linea.manual,
            },
          });
        }
      });
      creados++;
    }
  }

  await db.periodoNomina.update({
    where: { id: periodoId },
    data: { estado: periodo.estado === "ABIERTO" ? "CALCULADO" : periodo.estado },
  });

  return { creados, actualizados, omitidos, totalNeto: centavos(totalNeto) };
}

/// El sueldo del periodo no se guarda como linea: se deduce de la diferencia
/// entre las percepciones totales y las lineas de percepcion capturadas.
export function sueldoDeRecibo(
  totalPercepciones: number,
  lineas: { tipo: TipoConceptoNomina; importe: number }[]
): number {
  const otras = lineas
    .filter((linea) => linea.tipo === "PERCEPCION" || linea.tipo === "OTRO_PAGO")
    .reduce((suma, linea) => suma + linea.importe, 0);
  return centavos(totalPercepciones - otras);
}
