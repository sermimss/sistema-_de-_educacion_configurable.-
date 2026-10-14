import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { leerFecha, type ParcialCapturado } from "./fechasGrupo";
import { formatearDia } from "./formato";

/// Cada grupo trae su propio calendario: fecha de inicio y de termino de
/// clases y sus parciales. Por dentro eso se guarda como un CicloEscolar que
/// pertenece solo a ese grupo, porque calificaciones, asistencia, cargos e
/// inscripciones ya cuelgan del ciclo. Asi dos grupos pueden arrancar en
/// fechas distintas sin compartir nada.

/// Condicion de Prisma para ciclos cuyas fechas se cruzan con [inicio, fin].
export function ciclosQueSeCruzan(inicio: Date, fin: Date): Prisma.CicloEscolarWhereInput {
  return { fechaInicio: { lte: fin }, fechaFin: { gte: inicio } };
}

/// Crea el calendario del grupo: su ciclo interno y sus parciales. Se llama
/// dentro de la misma transaccion que crea el grupo.
export async function crearCalendarioDeGrupo(
  tx: Prisma.TransactionClient,
  datos: { nombreGrupo: string; inicio: string; fin: string; parciales: ParcialCapturado[] }
) {
  const inicio = leerFecha(datos.inicio)!;
  const fin = leerFecha(datos.fin)!;
  const ciclo = await tx.cicloEscolar.create({
    data: {
      nombre: `${datos.nombreGrupo} · ${formatearDia(inicio)} al ${formatearDia(fin)}`,
      // Provisional: la clave definitiva lleva el id del grupo y se pone
      // en cuanto el grupo existe (ver fijarClaveDelCiclo).
      clave: `G-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fechaInicio: inicio,
      fechaFin: fin,
      estado: "ACTIVO",
      activo: true,
    },
  });
  for (const [indice, parcial] of datos.parciales.entries()) {
    await tx.periodoEvaluacion.create({
      data: {
        cicloId: ciclo.id,
        numero: indice + 1,
        nombre: parcial.nombre.trim(),
        fechaInicio: leerFecha(parcial.fechaInicio)!,
        fechaFin: leerFecha(parcial.fechaFin)!,
        capturaAbierta: indice === 0,
      },
    });
  }
  return ciclo;
}

export async function fijarClaveDelCiclo(
  tx: Prisma.TransactionClient,
  cicloId: number,
  grupoId: number
) {
  await tx.cicloEscolar.update({ where: { id: cicloId }, data: { clave: `G${grupoId}` } });
}

/// El ciclo que hoy le toca al alumno: el del grupo donde esta inscrito y que
/// esta en curso. Si ninguno esta en curso (vacaciones, aun no empieza), el
/// mas reciente de sus inscripciones vigentes; si no, el mas reciente de
/// todos los que tuvo.
export async function cicloVigenteDeAlumno(alumnoId: number, hoy = new Date()) {
  const inscripciones = await db.inscripcion.findMany({
    where: { alumnoId },
    include: { ciclo: { include: { periodos: { orderBy: { numero: "asc" } } } } },
    orderBy: { ciclo: { fechaInicio: "desc" } },
  });
  if (inscripciones.length === 0) return null;
  const inscritas = inscripciones.filter((i) => i.estado === "INSCRITO");
  const enCurso = inscritas.find((i) => i.ciclo.fechaInicio <= hoy && i.ciclo.fechaFin >= hoy);
  return (enCurso ?? inscritas[0] ?? inscripciones[0]).ciclo;
}

/// Los calendarios de grupo que hoy estan en clases.
export async function ciclosEnCurso(hoy = new Date()) {
  return db.cicloEscolar.findMany({
    where: { estado: "ACTIVO", fechaInicio: { lte: hoy }, fechaFin: { gte: hoy } },
    orderBy: { fechaInicio: "asc" },
  });
}
