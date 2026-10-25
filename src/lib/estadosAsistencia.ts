import type { EstadoAsistencia } from "@prisma/client";

/// Sin acceso a la base: lo usa tambien el formulario del navegador.
export const ESTADOS_ASISTENCIA: { valor: EstadoAsistencia; etiqueta: string; corto: string }[] = [
  { valor: "PRESENTE", etiqueta: "Presente", corto: "P" },
  { valor: "AUSENTE", etiqueta: "Ausente", corto: "A" },
  { valor: "RETARDO", etiqueta: "Retardo", corto: "R" },
  { valor: "JUSTIFICADA", etiqueta: "Justificada", corto: "J" },
  { valor: "SALIDA_ANTICIPADA", etiqueta: "Salida anticipada", corto: "S" },
];
