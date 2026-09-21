import { db } from "./db";

/// Catalogos que alimentan los formularios de control escolar.
export async function catalogosEscolares() {
  const [planes, planteles, turnos, ciclos, aulas] = await Promise.all([
    db.planEstudios.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      include: { nivel: true },
    }),
    db.plantel.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    db.turno.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    db.cicloEscolar.findMany({ where: { activo: true }, orderBy: { fechaInicio: "desc" } }),
    db.aula.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } }),
  ]);

  return {
    planes: planes.map((plan) => ({
      id: plan.id,
      nombre: plan.nombre,
      clave: plan.clave,
      nivel: plan.nivel.nombre,
    })),
    planteles: planteles.map((p) => ({ id: p.id, nombre: p.nombre })),
    turnos: turnos.map((t) => ({ id: t.id, nombre: t.nombre })),
    ciclos: ciclos.map((c) => ({ id: c.id, nombre: c.nombre, estado: c.estado })),
    aulas: aulas.map((a) => ({ id: a.id, nombre: a.nombre })),
  };
}

export function nombreCompleto(persona: {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
}): string {
  return [persona.apellidoPaterno, persona.apellidoMaterno, persona.nombres]
    .filter(Boolean)
    .join(" ");
}
