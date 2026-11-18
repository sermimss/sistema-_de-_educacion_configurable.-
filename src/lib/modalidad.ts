import type { Prisma, TipoPeriodoAcademico } from "@prisma/client";

/// Cambiar un plan de estudios de modalidad (semestral, cuatrimestral...).
///
/// - Si el plan aun no tiene grupos ni alumnos, se convierte tal cual.
/// - Si ya tiene, se crea una version nueva del plan en la otra modalidad;
///   los alumnos actuales terminan en el suyo y el anterior deja de recibir
///   alumnos de nuevo ingreso.
///
/// En los dos casos las materias se reacomodan de forma proporcional (el 3er
/// semestre de 6 cae en el 4o cuatrimestre de 9) y el colegio las ajusta
/// despues en el mapa curricular: no hay una equivalencia automatica exacta.

export const MODALIDADES: { valor: TipoPeriodoAcademico; etiqueta: string; periodo: string; meses: number | null }[] = [
  { valor: "SEMESTRE", etiqueta: "Semestral", periodo: "Semestre", meses: 6 },
  { valor: "CUATRIMESTRE", etiqueta: "Cuatrimestral", periodo: "Cuatrimestre", meses: 4 },
  { valor: "TRIMESTRE", etiqueta: "Trimestral", periodo: "Trimestre", meses: 3 },
  { valor: "ANUAL", etiqueta: "Anual", periodo: "Ano", meses: 12 },
  { valor: "MODULAR", etiqueta: "Modular", periodo: "Modulo", meses: null },
  { valor: "PERSONALIZADO", etiqueta: "Personalizada", periodo: "Periodo", meses: null },
];

export function etiquetaModalidad(m: TipoPeriodoAcademico): string {
  return MODALIDADES.find((x) => x.valor === m)?.etiqueta ?? m;
}

export function plantillaSugerida(m: TipoPeriodoAcademico): string {
  const periodo = MODALIDADES.find((x) => x.valor === m)?.periodo ?? "Periodo";
  return m === "MODULAR" || m === "PERSONALIZADO" ? `${periodo} {N}` : `{N}o ${periodo}`;
}

/// Cuantos periodos dura lo mismo en la otra modalidad: 6 semestres son 36
/// meses, que en cuatrimestres son 9. Sin equivalencia (modular), igual.
export function periodosEquivalentes(actual: TipoPeriodoAcademico, periodos: number, nueva: TipoPeriodoAcademico): number {
  const de = MODALIDADES.find((x) => x.valor === actual)?.meses;
  const a = MODALIDADES.find((x) => x.valor === nueva)?.meses;
  if (!de || !a) return periodos;
  return Math.max(1, Math.round((periodos * de) / a));
}

/// A que periodo nuevo va lo que estaba en el periodo k de un plan de n.
export function periodoDestino(k: number, anteriores: number, nuevos: number): number {
  return Math.min(nuevos, Math.floor(((k - 1) * nuevos) / anteriores) + 1);
}

export function nombrePeriodo(plantilla: string, numero: number): string {
  return plantilla.replace(/\{N\}/g, String(numero)).trim();
}

export type CambioModalidad = {
  modalidad: TipoPeriodoAcademico;
  periodos: number;
  plantilla: string;
};

export function validarCambio(c: CambioModalidad): string | null {
  if (!MODALIDADES.some((m) => m.valor === c.modalidad)) return "Elige la modalidad.";
  if (!Number.isInteger(c.periodos) || c.periodos < 1 || c.periodos > 30) return "El numero de periodos debe ser de 1 a 30.";
  if (!c.plantilla.includes("{N}")) return "El nombre de cada periodo debe llevar {N} donde va el numero.";
  if (c.plantilla.length > 60) return "El nombre de cada periodo es demasiado largo.";
  return null;
}

/// Convierte el plan tal cual. Solo para planes sin grupos ni alumnos.
export async function convertirPlan(tx: Prisma.TransactionClient, planId: number, c: CambioModalidad) {
  const plan = await tx.planEstudios.findUniqueOrThrow({
    where: { id: planId },
    include: { grados: true, materias: { include: { grado: true } } },
  });
  const anteriores = plan.duracionPeriodos;

  // Grados 1..n con su nombre nuevo (se crean los que falten).
  const gradoPorNumero = new Map<number, number>();
  for (let numero = 1; numero <= c.periodos; numero++) {
    const existente = plan.grados.find((g) => g.numero === numero);
    const grado = existente
      ? await tx.grado.update({ where: { id: existente.id }, data: { nombre: nombrePeriodo(c.plantilla, numero), orden: numero } })
      : await tx.grado.create({ data: { planId, numero, nombre: nombrePeriodo(c.plantilla, numero), orden: numero } });
    gradoPorNumero.set(numero, grado.id);
  }

  // Materias al periodo proporcional. Si una misma materia cae dos veces en
  // el mismo periodo, se deja una.
  // El reparto nunca cruza materias (el periodo destino crece con el de
  // origen), asi que moviendo primero las del final cuando el plan crece, y
  // las del principio cuando se acorta, el lugar de destino ya esta libre y
  // no choca con la llave unica (plan, periodo, materia).
  const ocupadas = new Set<string>();
  const crece = c.periodos >= anteriores;
  const ordenadas = [...plan.materias].sort((a, b) =>
    crece ? b.grado.numero - a.grado.numero : a.grado.numero - b.grado.numero
  );
  for (const pm of ordenadas) {
    const destino = gradoPorNumero.get(periodoDestino(pm.grado.numero, anteriores, c.periodos))!;
    const llave = `${destino}-${pm.materiaId}`;
    if (ocupadas.has(llave)) {
      await tx.planMateria.delete({ where: { id: pm.id } });
      continue;
    }
    ocupadas.add(llave);
    if (destino !== pm.gradoId) {
      await tx.planMateria.update({ where: { id: pm.id }, data: { gradoId: destino } });
    }
  }

  // Los periodos que sobran ya no tienen materias ni grupos.
  await tx.grado.deleteMany({ where: { planId, numero: { gt: c.periodos } } });
  await tx.planEstudios.update({
    where: { id: planId },
    data: { modalidad: c.modalidad, duracionPeriodos: c.periodos },
  });
}

/// Crea la version nueva del plan en la otra modalidad, con sus periodos y,
/// si se pide, sus materias y prerrequisitos. El plan anterior queda para
/// los alumnos que ya lo cursan y deja de recibir nuevo ingreso.
export async function crearVersionPlan(
  tx: Prisma.TransactionClient,
  planId: number,
  c: CambioModalidad & { nombre: string; clave: string; copiarMaterias: boolean }
) {
  const anterior = await tx.planEstudios.findUniqueOrThrow({
    where: { id: planId },
    include: {
      materias: { include: { grado: true, prerrequisitos: true } },
    },
  });
  const ahora = new Date();
  const nuevo = await tx.planEstudios.create({
    data: {
      nombre: c.nombre,
      clave: c.clave,
      nivelId: anterior.nivelId,
      duracionPeriodos: c.periodos,
      modalidad: c.modalidad,
      creditosTotales: anterior.creditosTotales,
      vigenteDesde: ahora,
      activo: true,
    },
  });
  const gradoPorNumero = new Map<number, number>();
  for (let numero = 1; numero <= c.periodos; numero++) {
    const g = await tx.grado.create({
      data: { planId: nuevo.id, numero, nombre: nombrePeriodo(c.plantilla, numero), orden: numero },
    });
    gradoPorNumero.set(numero, g.id);
  }

  if (c.copiarMaterias) {
    const nuevaPorAnterior = new Map<number, number>();
    const ocupadas = new Set<string>();
    const ordenadas = [...anterior.materias].sort((a, b) => a.grado.numero - b.grado.numero || a.orden - b.orden);
    for (const pm of ordenadas) {
      const gradoId = gradoPorNumero.get(periodoDestino(pm.grado.numero, anterior.duracionPeriodos, c.periodos))!;
      const llave = `${gradoId}-${pm.materiaId}`;
      if (ocupadas.has(llave)) continue;
      ocupadas.add(llave);
      const copia = await tx.planMateria.create({
        data: {
          planId: nuevo.id,
          gradoId,
          materiaId: pm.materiaId,
          obligatoria: pm.obligatoria,
          creditos: pm.creditos,
          horasSemana: pm.horasSemana,
          orden: pm.orden,
        },
      });
      nuevaPorAnterior.set(pm.id, copia.id);
    }
    for (const pm of anterior.materias) {
      for (const pr of pm.prerrequisitos) {
        const desde = nuevaPorAnterior.get(pr.planMateriaId);
        const requiere = nuevaPorAnterior.get(pr.requierePlanMateriaId);
        if (desde && requiere && desde !== requiere) {
          await tx.prerrequisito.create({
            data: { planMateriaId: desde, requierePlanMateriaId: requiere, obligatorio: pr.obligatorio },
          });
        }
      }
    }
  }

  await tx.planEstudios.update({ where: { id: anterior.id }, data: { vigenteHasta: ahora } });
  return nuevo;
}

/// Un plan cuya vigencia ya termino solo sigue para quienes ya lo cursan.
export function aceptaNuevoIngreso(plan: { activo: boolean; vigenteHasta: Date | null }): boolean {
  return plan.activo && (!plan.vigenteHasta || plan.vigenteHasta > new Date());
}
