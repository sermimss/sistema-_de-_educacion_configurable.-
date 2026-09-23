import type { EstadoAsistencia } from "@prisma/client";
import { db } from "./db";
import { configNumero } from "./configuracion";

/// Cuenta faltas efectivas: las ausencias mas la equivalencia por retardos
/// que la escuela haya configurado (0 desactiva la equivalencia).
export function faltasEfectivas(
  registros: { estado: EstadoAsistencia }[],
  retardosPorFalta: number
): { ausencias: number; retardos: number; total: number } {
  const ausencias = registros.filter((r) => r.estado === "AUSENTE").length;
  const retardos = registros.filter((r) => r.estado === "RETARDO").length;
  const porRetardos = retardosPorFalta > 0 ? Math.floor(retardos / retardosPorFalta) : 0;
  return { ausencias, retardos, total: ausencias + porRetardos };
}

export function porcentajeAsistencia(registros: { estado: EstadoAsistencia }[]): number | null {
  if (registros.length === 0) return null;
  const presentes = registros.filter(
    (r) => r.estado === "PRESENTE" || r.estado === "JUSTIFICADA" || r.estado === "RETARDO"
  ).length;
  return Math.round((presentes / registros.length) * 1000) / 10;
}

/// Revisa si el alumno acumulo N faltas consecutivas y, de ser asi, levanta la
/// alerta y avisa a los administrativos. N lo define la escuela (3 por
/// omision). Sirve igual para el pase de lista por clase que por dia, segun se
/// le pase claseId o grupoId. No duplica alertas mientras haya una sin atender.
export async function revisarFaltasConsecutivas(
  alumnoId: number,
  ambito: { claseId?: number; grupoId?: number }
): Promise<boolean> {
  const umbral = await configNumero("asistencia.faltas_consecutivas_alerta", 3);
  if (umbral < 1) return false;
  if (!ambito.claseId && !ambito.grupoId) return false;

  const filtroSesion = ambito.claseId
    ? { claseId: ambito.claseId }
    : { grupoId: ambito.grupoId, claseId: null };

  const ultimos = await db.registroAsistencia.findMany({
    where: { alumnoId, sesion: filtroSesion },
    orderBy: { sesion: { fecha: "desc" } },
    take: umbral,
    include: { sesion: true },
  });

  if (ultimos.length < umbral) return false;
  if (!ultimos.every((registro) => registro.estado === "AUSENTE")) return false;

  const pendiente = await db.alertaAsistencia.findFirst({
    where: { alumnoId, claseId: ambito.claseId ?? null, atendida: false },
  });
  if (pendiente) return false;

  const [alumno, clase] = await Promise.all([
    db.alumno.findUnique({ where: { id: alumnoId } }),
    ambito.claseId
      ? db.clase.findUnique({
          where: { id: ambito.claseId },
          include: { planMateria: { include: { materia: true } }, grupo: true },
        })
      : null,
  ]);
  if (!alumno) return false;

  const grupo = clase
    ? clase.grupo
    : ambito.grupoId
      ? await db.grupo.findUnique({ where: { id: ambito.grupoId } })
      : null;

  await db.alertaAsistencia.create({
    data: { alumnoId, claseId: ambito.claseId ?? null, faltasConsecutivas: umbral },
  });

  // Aviso interno a los administrativos (la escuela pidio sin correo saliente).
  const administradores = await db.usuario.findMany({
    where: { rol: "ADMIN", activo: true },
    select: { id: true },
  });
  if (administradores.length > 0) {
    await db.notificacion.createMany({
      data: administradores.map((administrador) => ({
        usuarioId: administrador.id,
        tipo: "ALERTA_ASISTENCIA" as const,
        titulo: `${umbral} faltas consecutivas`,
        mensaje: clase
          ? `${alumno.nombres} ${alumno.apellidoPaterno} (${alumno.matricula}) acumula ${umbral} faltas seguidas en ${clase.planMateria.materia.nombre}, grupo ${clase.grupo.nombre}.`
          : `${alumno.nombres} ${alumno.apellidoPaterno} (${alumno.matricula}) acumula ${umbral} dias de falta seguidos en el grupo ${grupo?.nombre ?? ""}.`,
        url: `/panel/alumnos/${alumnoId}`,
        datos: { alumnoId, claseId: ambito.claseId ?? null, faltasConsecutivas: umbral },
      })),
    });
  }

  return true;
}

export const ESTADOS_ASISTENCIA: { valor: EstadoAsistencia; etiqueta: string; corto: string }[] = [
  { valor: "PRESENTE", etiqueta: "Presente", corto: "P" },
  { valor: "AUSENTE", etiqueta: "Ausente", corto: "A" },
  { valor: "RETARDO", etiqueta: "Retardo", corto: "R" },
  { valor: "JUSTIFICADA", etiqueta: "Justificada", corto: "J" },
  { valor: "SALIDA_ANTICIPADA", etiqueta: "Salida anticipada", corto: "S" },
];
