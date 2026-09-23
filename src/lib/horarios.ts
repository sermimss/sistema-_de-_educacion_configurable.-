import type { PrismaClient } from "@prisma/client";
import { db } from "./db";
import { configBool, configJson } from "./configuracion";

/// Dos rangos de "HH:MM" se traslapan si uno empieza antes de que el otro
/// termine. Tocarse en el limite (10:00-10:50 y 10:50-11:40) no es choque.
export function seTraslapan(aInicio: string, aFin: string, bInicio: string, bFin: string): boolean {
  return aInicio < bFin && bInicio < aFin;
}

export function esHoraValida(valor: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
}

export type Choque = { tipo: "DOCENTE" | "AULA" | "GRUPO"; mensaje: string };

type DatosHorario = {
  claseId: number;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  aulaId: number | null;
  /// Se excluye de la revision al editar un horario existente.
  horarioIdExcluido?: number;
};

/// Revisa que el docente, el aula y el grupo no queden en dos lugares a la vez.
/// Cada validacion se puede apagar desde Configuracion.
export async function detectarChoques(
  datos: DatosHorario,
  cliente: PrismaClient | typeof db = db
): Promise<Choque[]> {
  const clase = await cliente.clase.findUnique({
    where: { id: datos.claseId },
    include: {
      docente: true,
      grupo: true,
      planMateria: { include: { materia: true } },
    },
  });
  if (!clase) return [];

  const [validaDocente, validaAula, validaGrupo, diasHabiles] = await Promise.all([
    configBool("horarios.validar_choque_docente", true),
    configBool("horarios.validar_choque_aula", true),
    configBool("horarios.validar_choque_grupo", true),
    configJson<number[]>("horarios.dias_habiles", [1, 2, 3, 4, 5]),
  ]);

  const choques: Choque[] = [];

  if (!diasHabiles.includes(datos.diaSemana)) {
    choques.push({
      tipo: "GRUPO",
      mensaje: "Ese dia no esta marcado como habil en la configuracion del colegio.",
    });
  }

  // Todos los horarios del mismo ciclo y dia, menos el que se esta editando.
  const candidatos = await cliente.horarioClase.findMany({
    where: {
      diaSemana: datos.diaSemana,
      clase: { cicloId: clase.cicloId },
      ...(datos.horarioIdExcluido ? { NOT: { id: datos.horarioIdExcluido } } : {}),
    },
    include: {
      clase: {
        include: {
          docente: true,
          grupo: true,
          planMateria: { include: { materia: true } },
        },
      },
    },
  });

  for (const candidato of candidatos) {
    if (!seTraslapan(datos.horaInicio, datos.horaFin, candidato.horaInicio, candidato.horaFin)) {
      continue;
    }
    const rango = `${candidato.horaInicio}-${candidato.horaFin}`;

    if (validaDocente && candidato.clase.docenteId === clase.docenteId) {
      choques.push({
        tipo: "DOCENTE",
        mensaje: `${clase.docente.nombres} ${clase.docente.apellidoPaterno} ya tiene ${candidato.clase.planMateria.materia.nombre} con ${candidato.clase.grupo.nombre} en ${rango}.`,
      });
    }
    if (validaGrupo && candidato.clase.grupoId === clase.grupoId) {
      choques.push({
        tipo: "GRUPO",
        mensaje: `El grupo ${clase.grupo.nombre} ya tiene ${candidato.clase.planMateria.materia.nombre} en ${rango}.`,
      });
    }
    const aulaRevisada = datos.aulaId ?? clase.aulaId;
    const aulaCandidata = candidato.aulaId ?? candidato.clase.aulaId;
    if (validaAula && aulaRevisada && aulaCandidata === aulaRevisada) {
      choques.push({
        tipo: "AULA",
        mensaje: `El aula ya esta ocupada por ${candidato.clase.planMateria.materia.nombre} (${candidato.clase.grupo.nombre}) en ${rango}.`,
      });
    }
  }

  // Un mismo traslape puede detectarse por varias vias; se reporta una vez.
  const vistos = new Set<string>();
  return choques.filter((choque) => {
    if (vistos.has(choque.mensaje)) return false;
    vistos.add(choque.mensaje);
    return true;
  });
}
