/// Columnas aceptadas por el importador CSV. Vive fuera de las acciones de
/// servidor porque un archivo "use server" solo puede exportar funciones.

export type DefinicionColumnas = { obligatorias: string[]; opcionales: string[] };

export const COLUMNAS: Record<string, DefinicionColumnas> = {
  alumnos: {
    obligatorias: ["nombres", "apellido_paterno", "plan_clave"],
    opcionales: [
      "matricula", "apellido_materno", "curp", "fecha_nacimiento", "sexo", "email",
      "telefono", "direccion", "ciudad", "codigo_postal", "plantel_clave", "turno",
      "tutor_nombre", "tutor_telefono", "tutor_email", "crear_usuario",
    ],
  },
  personal: {
    obligatorias: ["nombres", "apellido_paterno"],
    opcionales: [
      "numero_empleado", "apellido_materno", "es_docente", "puesto", "grado_academico",
      "email", "telefono", "rfc", "curp", "nss", "tipo_contrato", "salario_base", "crear_usuario",
    ],
  },
  materias: {
    obligatorias: ["clave", "nombre"],
    opcionales: ["descripcion", "area"],
  },
};

/// Orden en el que se generan las columnas de la plantilla descargable.
export const ORDEN_PLANTILLA: Record<string, string[]> = {
  alumnos: [
    "plan_clave", "matricula", "nombres", "apellido_paterno", "apellido_materno", "curp",
    "fecha_nacimiento", "sexo", "email", "telefono", "direccion", "ciudad", "codigo_postal",
    "plantel_clave", "turno", "tutor_nombre", "tutor_telefono", "tutor_email", "crear_usuario",
  ],
  personal: [
    "numero_empleado", "nombres", "apellido_paterno", "apellido_materno", "es_docente", "puesto",
    "grado_academico", "email", "telefono", "rfc", "curp", "nss", "tipo_contrato",
    "salario_base", "crear_usuario",
  ],
  materias: ["clave", "nombre", "descripcion", "area"],
};

export const EJEMPLO_PLANTILLA: Record<string, string[]> = {
  alumnos: [
    "BG-01", "", "Ana Sofia", "Ramirez", "Lopez", "RALA080101MDFRPN01", "2008-01-01", "F",
    "ana@example.com", "5512345678", "Calle 1 #23", "Ciudad", "01000", "P1", "Matutino",
    "Maria Lopez", "5598765432", "maria@example.com", "si",
  ],
  personal: [
    "", "Luis", "Hernandez", "Gomez", "si", "Docente de Ciencias", "Maestria",
    "luis@example.com", "5511223344", "HEGL800101AB1", "HEGL800101HDFRMS02", "12345678901",
    "TIEMPO_COMPLETO", "18000", "si",
  ],
  materias: ["MAT-101", "Matematicas I", "Algebra basica", "Ciencias exactas"],
};
