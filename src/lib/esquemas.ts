import { z } from "zod";

const textoOpcional = z.string().trim().optional().or(z.literal(""));

export const esquemaAlumno = z.object({
  matricula: z.string().trim().optional().or(z.literal("")),
  nombres: z.string().trim().min(2, "Escribe el nombre del alumno."),
  apellidoPaterno: z.string().trim().min(2, "Escribe el apellido paterno."),
  apellidoMaterno: textoOpcional,
  curp: z.string().trim().toUpperCase().optional().or(z.literal("")),
  fechaNacimiento: textoOpcional,
  sexo: textoOpcional,
  email: z.string().trim().email("Correo invalido.").optional().or(z.literal("")),
  telefono: textoOpcional,
  direccion: textoOpcional,
  ciudad: textoOpcional,
  codigoPostal: textoOpcional,
  planId: z.coerce.number().int().positive("Selecciona el plan de estudios."),
  plantelId: z.coerce.number().int().optional(),
  turnoId: z.coerce.number().int().optional(),
  estado: z.enum(["ACTIVO", "BAJA_TEMPORAL", "BAJA_DEFINITIVA", "EGRESADO", "SUSPENDIDO"]),
  tipoSangre: textoOpcional,
  alergias: textoOpcional,
  padecimientos: textoOpcional,
  rfcFacturacion: textoOpcional,
  crearUsuario: z.coerce.boolean().optional(),
});

export const esquemaTutor = z.object({
  nombre: z.string().trim().min(3, "Escribe el nombre del tutor."),
  parentesco: textoOpcional,
  telefono: textoOpcional,
  email: z.string().trim().email("Correo invalido.").optional().or(z.literal("")),
  esResponsableFinanciero: z.coerce.boolean().optional(),
  esContactoEmergencia: z.coerce.boolean().optional(),
});

export const esquemaEmpleado = z.object({
  numeroEmpleado: z.string().trim().optional().or(z.literal("")),
  nombres: z.string().trim().min(2, "Escribe el nombre."),
  apellidoPaterno: z.string().trim().min(2, "Escribe el apellido paterno."),
  apellidoMaterno: textoOpcional,
  esDocente: z.coerce.boolean().optional(),
  puesto: textoOpcional,
  gradoAcademico: textoOpcional,
  email: z.string().trim().email("Correo invalido.").optional().or(z.literal("")),
  telefono: textoOpcional,
  rfc: textoOpcional,
  curp: textoOpcional,
  nss: textoOpcional,
  tipoContrato: z
    .enum(["TIEMPO_COMPLETO", "MEDIO_TIEMPO", "POR_HORAS", "HONORARIOS", "TEMPORAL"])
    .optional()
    .or(z.literal("")),
  salarioBase: z.coerce.number().min(0).optional(),
  pagoPorHora: z.coerce.number().min(0).optional(),
  banco: textoOpcional,
  clabe: textoOpcional,
  estado: z.enum(["ACTIVO", "LICENCIA", "SUSPENDIDO", "BAJA"]),
  crearUsuario: z.coerce.boolean().optional(),
});

export const esquemaMateria = z.object({
  clave: z.string().trim().min(1, "La clave es obligatoria.").toUpperCase(),
  nombre: z.string().trim().min(2, "El nombre es obligatorio."),
  descripcion: textoOpcional,
  areaId: z.coerce.number().int().optional(),
  activa: z.coerce.boolean().optional(),
});

export const esquemaPlanMateria = z.object({
  planId: z.coerce.number().int().positive(),
  gradoId: z.coerce.number().int().positive("Selecciona el grado."),
  materiaId: z.coerce.number().int().positive("Selecciona la materia."),
  obligatoria: z.coerce.boolean().optional(),
  creditos: z.coerce.number().int().min(0).optional(),
  horasSemana: z.coerce.number().int().min(0).optional(),
});

export const esquemaGrupo = z.object({
  nombre: z.string().trim().min(1, "El nombre del grupo es obligatorio."),
  cicloId: z.coerce.number().int().positive("Selecciona el ciclo."),
  planId: z.coerce.number().int().positive("Selecciona el plan."),
  gradoId: z.coerce.number().int().positive("Selecciona el grado."),
  plantelId: z.coerce.number().int().optional(),
  turnoId: z.coerce.number().int().optional(),
  aulaId: z.coerce.number().int().optional(),
  cupoMaximo: z.coerce.number().int().min(1).optional(),
  activo: z.coerce.boolean().optional(),
});

export const esquemaClase = z.object({
  grupoId: z.coerce.number().int().positive(),
  planMateriaId: z.coerce.number().int().positive("Selecciona la materia."),
  docenteId: z.coerce.number().int().positive("Selecciona el docente."),
  aulaId: z.coerce.number().int().optional(),
});

export type DatosAlumno = z.infer<typeof esquemaAlumno>;
export type DatosEmpleado = z.infer<typeof esquemaEmpleado>;
export type DatosGrupo = z.infer<typeof esquemaGrupo>;
