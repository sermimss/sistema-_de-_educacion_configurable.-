import type { RolUsuario } from "@prisma/client";

export type ItemNavegacion = {
  etiqueta: string;
  ruta: string;
  roles: RolUsuario[];
  /// Fase del plan de entrega en la que se habilita. De la 1 a la 4 ya estan
  /// disponibles; la 5 (nomina) sigue pendiente.
  fase: 1 | 2 | 3 | 4 | 5;
  grupo: "general" | "control" | "academico" | "finanzas" | "sistema";
};

export const NAVEGACION: ItemNavegacion[] = [
  { etiqueta: "Panel", ruta: "/panel", roles: ["ADMIN", "DOCENTE", "ALUMNO"], fase: 1, grupo: "general" },

  { etiqueta: "Alumnos", ruta: "/panel/alumnos", roles: ["ADMIN"], fase: 2, grupo: "control" },
  { etiqueta: "Personal y docentes", ruta: "/panel/personal", roles: ["ADMIN"], fase: 2, grupo: "control" },
  { etiqueta: "Materias", ruta: "/panel/materias", roles: ["ADMIN"], fase: 2, grupo: "control" },
  { etiqueta: "Grupos y clases", ruta: "/panel/grupos", roles: ["ADMIN"], fase: 2, grupo: "control" },
  { etiqueta: "Importar CSV", ruta: "/panel/importar", roles: ["ADMIN"], fase: 2, grupo: "control" },

  { etiqueta: "Horarios", ruta: "/panel/horarios", roles: ["ADMIN"], fase: 3, grupo: "academico" },
  { etiqueta: "Asistencia", ruta: "/panel/asistencia", roles: ["ADMIN", "DOCENTE"], fase: 3, grupo: "academico" },
  { etiqueta: "Calificaciones", ruta: "/panel/calificaciones", roles: ["ADMIN", "DOCENTE"], fase: 3, grupo: "academico" },
  { etiqueta: "Mis clases", ruta: "/panel/mis-clases", roles: ["DOCENTE"], fase: 3, grupo: "academico" },
  { etiqueta: "Boletas y promedios", ruta: "/panel/boletas", roles: ["ADMIN"], fase: 3, grupo: "academico" },

  { etiqueta: "Finanzas", ruta: "/panel/finanzas", roles: ["ADMIN"], fase: 4, grupo: "finanzas" },
  { etiqueta: "Mis calificaciones", ruta: "/panel/mis-calificaciones", roles: ["ALUMNO"], fase: 4, grupo: "academico" },
  { etiqueta: "Mi asistencia", ruta: "/panel/mi-asistencia", roles: ["ALUMNO"], fase: 4, grupo: "academico" },
  { etiqueta: "Mi horario", ruta: "/panel/mi-horario", roles: ["ALUMNO"], fase: 4, grupo: "academico" },
  { etiqueta: "Estado de cuenta", ruta: "/panel/estado-de-cuenta", roles: ["ALUMNO"], fase: 4, grupo: "finanzas" },
  { etiqueta: "Nomina", ruta: "/panel/nomina", roles: ["ADMIN"], fase: 5, grupo: "finanzas" },

  { etiqueta: "Estructura academica", ruta: "/panel/academico", roles: ["ADMIN"], fase: 1, grupo: "sistema" },
  { etiqueta: "Configuracion", ruta: "/panel/configuracion", roles: ["ADMIN"], fase: 1, grupo: "sistema" },
  { etiqueta: "Bitacora", ruta: "/panel/bitacora", roles: ["ADMIN"], fase: 1, grupo: "sistema" },
];

/// Fases ya construidas: sus pantallas son navegables.
export const FASES_DISPONIBLES = [1, 2, 3, 4];

export function estaDisponible(item: ItemNavegacion): boolean {
  return FASES_DISPONIBLES.includes(item.fase);
}

export function navegacionPara(rol: RolUsuario): ItemNavegacion[] {
  return NAVEGACION.filter((item) => item.roles.includes(rol));
}

export const ETIQUETA_ROL: Record<RolUsuario, string> = {
  ADMIN: "Administracion",
  DOCENTE: "Docente",
  ALUMNO: "Alumno",
};

export const ETIQUETA_GRUPO: Record<ItemNavegacion["grupo"], string> = {
  general: "",
  control: "Control escolar",
  academico: "Academico",
  finanzas: "Finanzas",
  sistema: "Sistema",
};
