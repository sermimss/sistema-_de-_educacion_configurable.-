import { z } from "zod";

/// Contrato unico entre el asistente (cliente) y la accion de servidor.
/// Todo lo que aparece aqui lo define la escuela en la instalacion.

export const esquemaInstitucion = z.object({
  nombre: z.string().min(3, "El nombre de la institucion es obligatorio."),
  nombreCorto: z.string().optional(),
  lema: z.string().optional(),
  colorPrimario: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color invalido."),
  colorSecundario: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  direccion: z.string().optional(),
  ciudad: z.string().optional(),
  estado: z.string().optional(),
  pais: z.string().default("Mexico"),
  codigoPostal: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email("Correo invalido.").optional().or(z.literal("")),
  sitioWeb: z.string().optional(),
  razonSocial: z.string().optional(),
  rfc: z.string().optional(),
  regimenFiscal: z.string().optional(),
  claveCentroTrabajo: z.string().optional(),
  moneda: z.string().default("MXN"),
  simboloMoneda: z.string().default("$"),
  zonaHoraria: z.string().default("America/Mexico_City"),
});

export const esquemaPlantel = z.object({
  nombre: z.string().min(2),
  clave: z.string().min(1),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
});

export const esquemaTurno = z.object({
  nombre: z.string().min(2),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/),
});

export const esquemaNivel = z.object({
  nombre: z.string().min(2),
  clave: z.string().min(1),
  tipoPeriodo: z.enum(["SEMESTRE", "CUATRIMESTRE", "TRIMESTRE", "ANUAL", "MODULAR", "PERSONALIZADO"]),
});

export const esquemaPlan = z.object({
  nombre: z.string().min(2),
  clave: z.string().min(1),
  nivelClave: z.string().min(1),
  duracionPeriodos: z.coerce.number().int().min(1).max(30),
  creditosTotales: z.coerce.number().int().min(0).optional(),
  /// Como se llama cada periodo del plan: "{N}o Semestre", "Modulo {N}"...
  plantillaGrado: z.string().default("{N}o Semestre"),
});

export const esquemaCiclo = z.object({
  nombre: z.string().min(2),
  clave: z.string().min(1),
  fechaInicio: z.string().min(8),
  fechaFin: z.string().min(8),
  numeroPeriodos: z.coerce.number().int().min(1).max(12),
  plantillaPeriodo: z.string().default("Parcial {N}"),
});

export const esquemaEscala = z.object({
  nombre: z.string().min(2),
  tipo: z.enum(["NUMERICA", "LETRA", "CONCEPTUAL"]),
  valorMinimo: z.coerce.number(),
  valorMaximo: z.coerce.number(),
  decimales: z.coerce.number().int().min(0).max(4),
  redondeo: z.enum(["NINGUNO", "MATEMATICO", "HACIA_ARRIBA", "HACIA_ABAJO"]),
  minimaAprobatoria: z.coerce.number(),
});

export const esquemaModulo = z.object({
  nombre: z.string().min(1),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/),
  esReceso: z.boolean().default(false),
});

export const esquemaConceptoCobro = z.object({
  clave: z.string().min(1),
  nombre: z.string().min(2),
  tipo: z.enum([
    "INSCRIPCION", "REINSCRIPCION", "COLEGIATURA", "MATERIAL", "UNIFORME",
    "TRANSPORTE", "EVENTO", "EXAMEN", "TRAMITE", "OTRO",
  ]),
  montoBase: z.coerce.number().min(0),
  periodicidad: z.enum([
    "UNICO", "MENSUAL", "BIMESTRAL", "POR_PERIODO_ACADEMICO", "SEMESTRAL", "ANUAL",
  ]),
  diaVencimiento: z.coerce.number().int().min(1).max(31).optional(),
  obligatorio: z.boolean().default(true),
});

export const esquemaInstalacion = z.object({
  institucion: esquemaInstitucion,
  planteles: z.array(esquemaPlantel).min(1, "Registra al menos un plantel."),
  turnos: z.array(esquemaTurno).min(1, "Registra al menos un turno."),
  niveles: z.array(esquemaNivel).min(1, "Registra al menos un nivel educativo."),
  planes: z.array(esquemaPlan).min(1, "Registra al menos un plan de estudios."),
  ciclo: esquemaCiclo,
  escala: esquemaEscala,
  horarios: z.object({
    diasHabiles: z.array(z.coerce.number().int().min(1).max(7)).min(1),
    duracionModuloMinutos: z.coerce.number().int().min(10).max(300),
    modulos: z.array(esquemaModulo).min(1, "Define al menos un modulo de horario."),
  }),
  asistencia: z.object({
    docenteDecideModo: z.boolean(),
    modoPredeterminado: z.enum(["POR_DIA", "POR_CLASE"]),
    docenteDecideAfectacion: z.boolean(),
    faltasConsecutivasAlerta: z.coerce.number().int().min(1).max(30),
    retardosEquivalenFalta: z.coerce.number().int().min(0).max(20),
  }),
  finanzas: z.object({
    diaVencimientoDefault: z.coerce.number().int().min(1).max(31),
    conceptos: z.array(esquemaConceptoCobro),
    recargoActivo: z.boolean(),
    recargoTipoCalculo: z.enum(["FIJO", "PORCENTAJE"]),
    recargoValor: z.coerce.number().min(0),
    recargoDiasGracia: z.coerce.number().int().min(0).max(60),
    permitePagosParciales: z.boolean(),
    permiteConvenios: z.boolean(),
    serieRecibo: z.string().min(1),
    leyendaRecibo: z.string(),
    bloquearPorAdeudo: z.boolean(),
  }),
  administrador: z.object({
    usuario: z.string().min(3, "Minimo 3 caracteres.").regex(/^[a-zA-Z0-9._-]+$/, "Solo letras, numeros, punto, guion y guion bajo."),
    email: z.string().email("Correo invalido."),
    nombres: z.string().min(2),
    apellidoPaterno: z.string().min(2),
    apellidoMaterno: z.string().optional(),
    password: z.string().min(8, "Minimo 8 caracteres."),
  }),
});

export type DatosInstalacion = z.infer<typeof esquemaInstalacion>;
