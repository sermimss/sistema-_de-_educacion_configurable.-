import { db } from "./db";
import { configNumero } from "./configuracion";
import { normalizarConEscala, promedioDePeriodos, promedioSimple, type EscalaBasica } from "./calificaciones";

export type ResumenRecalculo = {
  alumnosProcesados: number;
  materiasCerradas: number;
  cuadroHonor: number;
};

async function escalaPredeterminada(): Promise<EscalaBasica> {
  const escala = await db.escalaCalificacion.findFirst({ where: { predeterminada: true } });
  return {
    valorMinimo: Number(escala?.valorMinimo ?? 0),
    valorMaximo: Number(escala?.valorMaximo ?? 100),
    decimales: escala?.decimales ?? 2,
    redondeo: escala?.redondeo ?? "NINGUNO",
    minimaAprobatoria: Number(escala?.minimaAprobatoria ?? 70),
  };
}

/// Recalcula la calificacion final de cada materia, el promedio del ciclo,
/// la posicion en el ranking y el cuadro de honor. Es idempotente: se puede
/// correr cuantas veces haga falta.
export async function recalcularPromedios(cicloId: number): Promise<ResumenRecalculo> {
  const escala = await escalaPredeterminada();
  const minimoCuadroHonor = await configNumero(
    "evaluacion.cuadro_honor_promedio_minimo",
    escala.valorMaximo
  );

  const periodos = await db.periodoEvaluacion.findMany({ where: { cicloId } });
  const pesoPorPeriodo = new Map(periodos.map((periodo) => [periodo.id, Number(periodo.peso)]));

  const inscripciones = await db.inscripcion.findMany({
    where: { cicloId, estado: "INSCRITO" },
    include: { alumno: true },
  });

  let materiasCerradas = 0;
  const promediosCalculados: { alumnoId: number; promedio: number | null; datos: {
    materiasAprobadas: number;
    materiasReprobadas: number;
    creditosAprobados: number;
  } }[] = [];

  for (const inscripcion of inscripciones) {
    const clasesDelAlumno = await db.alumnoClase.findMany({
      where: { alumnoId: inscripcion.alumnoId, estado: { not: "BAJA" }, clase: { cicloId } },
      include: {
        clase: {
          include: {
            planMateria: true,
            calificaciones: { where: { alumnoId: inscripcion.alumnoId } },
            extraordinarios: { where: { alumnoId: inscripcion.alumnoId }, orderBy: { fecha: "desc" } },
          },
        },
      },
    });

    const finales: number[] = [];
    let materiasAprobadas = 0;
    let materiasReprobadas = 0;
    let creditosAprobados = 0;

    for (const inscripcionClase of clasesDelAlumno) {
      const clase = inscripcionClase.clase;

      // El extraordinario mas reciente pisa el promedio de los periodos.
      const extraordinario = clase.extraordinarios[0];
      const final = extraordinario
        ? Number(extraordinario.calificacion)
        : promedioDePeriodos(
            clase.calificaciones.map((calificacion) => ({
              calificacion: calificacion.calificacion != null ? Number(calificacion.calificacion) : null,
              peso: pesoPorPeriodo.get(calificacion.periodoId) ?? 1,
            })),
            escala
          );

      if (final == null) continue;

      const aprobada = final >= escala.minimaAprobatoria;
      if (aprobada) {
        materiasAprobadas++;
        creditosAprobados += clase.planMateria.creditos ?? 0;
      } else {
        materiasReprobadas++;
      }
      finales.push(final);

      await db.alumnoClase.update({
        where: { id: inscripcionClase.id },
        data: {
          calificacionFinal: normalizarConEscala(final, escala),
          estado: aprobada ? "APROBADA" : "REPROBADA",
        },
      });
      materiasCerradas++;
    }

    promediosCalculados.push({
      alumnoId: inscripcion.alumnoId,
      promedio: promedioSimple(finales, escala),
      datos: { materiasAprobadas, materiasReprobadas, creditosAprobados },
    });
  }

  // El ranking se arma sobre los alumnos que ya tienen promedio.
  const conPromedio = promediosCalculados
    .filter((fila) => fila.promedio != null)
    .sort((a, b) => (b.promedio ?? 0) - (a.promedio ?? 0));

  let cuadroHonor = 0;
  for (const [indice, fila] of conPromedio.entries()) {
    const promedio = fila.promedio!;
    const enCuadroHonor = promedio >= minimoCuadroHonor && fila.datos.materiasReprobadas === 0;
    if (enCuadroHonor) cuadroHonor++;

    await db.promedioCiclo.upsert({
      where: { alumnoId_cicloId: { alumnoId: fila.alumnoId, cicloId } },
      update: {
        promedio,
        materiasAprobadas: fila.datos.materiasAprobadas,
        materiasReprobadas: fila.datos.materiasReprobadas,
        creditosAprobados: fila.datos.creditosAprobados,
        posicionRanking: indice + 1,
        cuadroHonor: enCuadroHonor,
        calculadoEn: new Date(),
      },
      create: {
        alumnoId: fila.alumnoId,
        cicloId,
        promedio,
        materiasAprobadas: fila.datos.materiasAprobadas,
        materiasReprobadas: fila.datos.materiasReprobadas,
        creditosAprobados: fila.datos.creditosAprobados,
        posicionRanking: indice + 1,
        cuadroHonor: enCuadroHonor,
      },
    });

    await db.alumno.update({
      where: { id: fila.alumnoId },
      data: { promedioGeneral: promedio },
    });
  }

  return {
    alumnosProcesados: conPromedio.length,
    materiasCerradas,
    cuadroHonor,
  };
}
