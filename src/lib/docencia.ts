import { cache } from "react";
import { db } from "./db";
import type { DatosSesion } from "./sesion";

/// Empleado ligado a la sesion del docente. Se memoiza por peticion porque
/// casi toda pantalla del portal docente lo necesita.
export const empleadoDeSesion = cache(async (usuarioId: number) => {
  return db.empleado.findUnique({ where: { usuarioId } });
});

/// Clases del ciclo activo que imparte el docente de la sesion.
export async function clasesDelDocente(usuarioId: number) {
  const empleado = await empleadoDeSesion(usuarioId);
  if (!empleado) return [];
  return db.clase.findMany({
    where: { docenteId: empleado.id, ciclo: { estado: "ACTIVO" } },
    orderBy: [{ grupoId: "asc" }, { id: "asc" }],
    include: {
      grupo: { include: { grado: true, turno: true } },
      planMateria: { include: { materia: true } },
      ciclo: true,
      aula: true,
      _count: { select: { alumnos: true } },
    },
  });
}

/// Verifica que la clase sea del docente; el administrador pasa siempre.
export async function claseAccesible(sesion: DatosSesion, claseId: number): Promise<boolean> {
  if (sesion.rol === "ADMIN") return true;
  if (sesion.rol !== "DOCENTE") return false;
  const empleado = await empleadoDeSesion(sesion.usuarioId);
  if (!empleado) return false;
  const clase = await db.clase.findUnique({ where: { id: claseId }, select: { docenteId: true } });
  return clase?.docenteId === empleado.id;
}
