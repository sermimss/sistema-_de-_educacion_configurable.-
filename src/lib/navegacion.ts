import type { RolUsuario } from "@prisma/client";

export type ItemNavegacion = {
  etiqueta: string;
  ruta: string;
  roles: RolUsuario[];
  /// Fase del plan de entrega en la que se habilita. 1 = ya disponible.
  fase: 1 | 2 | 3 | 4 | 5;
};

export const NAVEGACION: ItemNavegacion[] = [
  { etiqueta: "Panel", ruta: "/panel", roles: ["ADMIN", "DOCENTE", "ALUMNO"], fase: 1 },
  { etiqueta: "Configuracion", ruta: "/panel/configuracion", roles: ["ADMIN"], fase: 1 },
  { etiqueta: "Estructura academica", ruta: "/panel/academico", roles: ["ADMIN"], fase: 1 },
  { etiqueta: "Alumnos", ruta: "/panel/alumnos", roles: ["ADMIN"], fase: 2 },
  { etiqueta: "Personal y docentes", ruta: "/panel/personal", roles: ["ADMIN"], fase: 2 },
  { etiqueta: "Grupos y clases", ruta: "/panel/clases", roles: ["ADMIN"], fase: 2 },
  { etiqueta: "Horarios", ruta: "/panel/horarios", roles: ["ADMIN"], fase: 3 },
  { etiqueta: "Asistencia", ruta: "/panel/asistencia", roles: ["ADMIN", "DOCENTE"], fase: 3 },
  { etiqueta: "Calificaciones", ruta: "/panel/calificaciones", roles: ["ADMIN", "DOCENTE"], fase: 3 },
  { etiqueta: "Mis clases", ruta: "/panel/mis-clases", roles: ["DOCENTE"], fase: 3 },
  { etiqueta: "Finanzas", ruta: "/panel/finanzas", roles: ["ADMIN"], fase: 4 },
  { etiqueta: "Nomina", ruta: "/panel/nomina", roles: ["ADMIN"], fase: 5 },
  { etiqueta: "Mis calificaciones", ruta: "/panel/mis-calificaciones", roles: ["ALUMNO"], fase: 4 },
  { etiqueta: "Mi asistencia", ruta: "/panel/mi-asistencia", roles: ["ALUMNO"], fase: 4 },
  { etiqueta: "Mi horario", ruta: "/panel/mi-horario", roles: ["ALUMNO"], fase: 4 },
  { etiqueta: "Estado de cuenta", ruta: "/panel/estado-de-cuenta", roles: ["ALUMNO"], fase: 4 },
  { etiqueta: "Bitacora", ruta: "/panel/bitacora", roles: ["ADMIN"], fase: 1 },
];

export function navegacionPara(rol: RolUsuario): ItemNavegacion[] {
  return NAVEGACION.filter((item) => item.roles.includes(rol));
}

export const ETIQUETA_ROL: Record<RolUsuario, string> = {
  ADMIN: "Administracion",
  DOCENTE: "Docente",
  ALUMNO: "Alumno",
};
