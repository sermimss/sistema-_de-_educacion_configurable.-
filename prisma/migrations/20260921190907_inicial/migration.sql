-- CreateEnum
CREATE TYPE "TipoConfiguracion" AS ENUM ('TEXTO', 'NUMERO', 'BOOLEANO', 'JSON', 'FECHA', 'COLOR', 'ARCHIVO', 'OPCION');

-- CreateEnum
CREATE TYPE "TipoPeriodoAcademico" AS ENUM ('SEMESTRE', 'CUATRIMESTRE', 'TRIMESTRE', 'ANUAL', 'MODULAR', 'PERSONALIZADO');

-- CreateEnum
CREATE TYPE "EstadoCiclo" AS ENUM ('PLANEACION', 'ACTIVO', 'CERRADO');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'DOCENTE', 'ALUMNO');

-- CreateEnum
CREATE TYPE "EstadoAlumno" AS ENUM ('ACTIVO', 'BAJA_TEMPORAL', 'BAJA_DEFINITIVA', 'EGRESADO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "EstadoInscripcion" AS ENUM ('INSCRITO', 'BAJA', 'CONCLUIDO');

-- CreateEnum
CREATE TYPE "TipoEscala" AS ENUM ('NUMERICA', 'LETRA', 'CONCEPTUAL');

-- CreateEnum
CREATE TYPE "ModoRedondeo" AS ENUM ('NINGUNO', 'MATEMATICO', 'HACIA_ARRIBA', 'HACIA_ABAJO');

-- CreateEnum
CREATE TYPE "ModoAsistencia" AS ENUM ('POR_DIA', 'POR_CLASE');

-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('PRESENTE', 'AUSENTE', 'RETARDO', 'JUSTIFICADA', 'SALIDA_ANTICIPADA');

-- CreateEnum
CREATE TYPE "OrigenCalificacion" AS ENUM ('CALCULADA', 'MANUAL', 'EXTRAORDINARIO');

-- CreateEnum
CREATE TYPE "EstadoMateriaAlumno" AS ENUM ('EN_CURSO', 'APROBADA', 'REPROBADA', 'EXENTA', 'RECURSANDO', 'BAJA');

-- CreateEnum
CREATE TYPE "TipoInscripcionClase" AS ENUM ('REGULAR', 'OPTATIVA', 'RECURSAMIENTO');

-- CreateEnum
CREATE TYPE "TipoEvaluacionExtra" AS ENUM ('EXTRAORDINARIO', 'RECUPERACION', 'TITULO_SUFICIENCIA');

-- CreateEnum
CREATE TYPE "Periodicidad" AS ENUM ('UNICO', 'MENSUAL', 'BIMESTRAL', 'POR_PERIODO_ACADEMICO', 'SEMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "AmbitoAplicacion" AS ENUM ('TODOS', 'NIVEL', 'PLAN', 'GRADO', 'GRUPO', 'ALUMNO');

-- CreateEnum
CREATE TYPE "TipoConceptoCobro" AS ENUM ('INSCRIPCION', 'REINSCRIPCION', 'COLEGIATURA', 'MATERIAL', 'UNIFORME', 'TRANSPORTE', 'EVENTO', 'EXAMEN', 'TRAMITE', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoCalculo" AS ENUM ('FIJO', 'PORCENTAJE');

-- CreateEnum
CREATE TYPE "FrecuenciaRecargo" AS ENUM ('UNICA', 'DIARIA', 'SEMANAL', 'MENSUAL');

-- CreateEnum
CREATE TYPE "EstadoCargo" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADO', 'VENCIDO', 'CANCELADO', 'CONDONADO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA_CREDITO', 'TARJETA_DEBITO', 'CHEQUE', 'DEPOSITO', 'PAGO_EN_LINEA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('REGISTRADO', 'CONFIRMADO', 'CANCELADO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "EstadoCfdi" AS ENUM ('NO_APLICA', 'PENDIENTE', 'TIMBRADO', 'CANCELADO', 'ERROR');

-- CreateEnum
CREATE TYPE "ProveedorPasarela" AS ENUM ('STRIPE', 'MERCADO_PAGO', 'OPENPAY', 'CONEKTA', 'SPEI_MANUAL');

-- CreateEnum
CREATE TYPE "ModoPasarela" AS ENUM ('SANDBOX', 'PRODUCCION');

-- CreateEnum
CREATE TYPE "EstadoConvenio" AS ENUM ('VIGENTE', 'CUMPLIDO', 'INCUMPLIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoConceptoNomina" AS ENUM ('PERCEPCION', 'DEDUCCION', 'OTRO_PAGO');

-- CreateEnum
CREATE TYPE "EstadoPeriodoNomina" AS ENUM ('ABIERTO', 'CALCULADO', 'PAGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoReciboNomina" AS ENUM ('BORRADOR', 'AUTORIZADO', 'PAGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('TIEMPO_COMPLETO', 'MEDIO_TIEMPO', 'POR_HORAS', 'HONORARIOS', 'TEMPORAL');

-- CreateEnum
CREATE TYPE "EstadoEmpleado" AS ENUM ('ACTIVO', 'LICENCIA', 'SUSPENDIDO', 'BAJA');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('INFORMATIVA', 'ALERTA_ASISTENCIA', 'ADEUDO', 'CALIFICACION', 'SISTEMA', 'AVISO');

-- CreateEnum
CREATE TYPE "AccionBitacora" AS ENUM ('CREAR', 'ACTUALIZAR', 'ELIMINAR', 'INICIAR_SESION', 'CERRAR_SESION', 'INTENTO_FALLIDO', 'EXPORTAR', 'IMPORTAR', 'CONFIGURAR', 'CANCELAR');

-- CreateEnum
CREATE TYPE "TipoEntidadExpediente" AS ENUM ('ALUMNO', 'EMPLEADO');

-- CreateTable
CREATE TABLE "Institucion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nombre" TEXT NOT NULL,
    "nombreCorto" TEXT,
    "lema" TEXT,
    "logoUrl" TEXT,
    "escudoUrl" TEXT,
    "colorPrimario" TEXT NOT NULL DEFAULT '#1d4ed8',
    "colorSecundario" TEXT NOT NULL DEFAULT '#0f172a',
    "direccion" TEXT,
    "ciudad" TEXT,
    "estado" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Mexico',
    "codigoPostal" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "sitioWeb" TEXT,
    "razonSocial" TEXT,
    "rfc" TEXT,
    "regimenFiscal" TEXT,
    "claveCentroTrabajo" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'MXN',
    "simboloMoneda" TEXT NOT NULL DEFAULT '$',
    "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "idioma" TEXT NOT NULL DEFAULT 'es-MX',
    "instalado" BOOLEAN NOT NULL DEFAULT false,
    "fechaInstalacion" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "tipo" "TipoConfiguracion" NOT NULL DEFAULT 'TEXTO',
    "categoria" TEXT NOT NULL DEFAULT 'general',
    "etiqueta" TEXT NOT NULL,
    "descripcion" TEXT,
    "opciones" JSONB,
    "editable" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plantel" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Plantel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turno" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aula" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "clave" TEXT,
    "plantelId" INTEGER,
    "capacidad" INTEGER,
    "tipo" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Aula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuloHorario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "esReceso" BOOLEAN NOT NULL DEFAULT false,
    "turnoId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ModuloHorario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NivelEducativo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "tipoPeriodo" "TipoPeriodoAcademico" NOT NULL DEFAULT 'SEMESTRE',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NivelEducativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEstudios" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nivelId" INTEGER NOT NULL,
    "duracionPeriodos" INTEGER NOT NULL,
    "creditosTotales" INTEGER,
    "vigenteDesde" TIMESTAMP(3),
    "vigenteHasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PlanEstudios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grado" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Grado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "clave" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Materia" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "areaId" INTEGER,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Materia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanMateria" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "gradoId" INTEGER NOT NULL,
    "materiaId" INTEGER NOT NULL,
    "obligatoria" BOOLEAN NOT NULL DEFAULT true,
    "creditos" INTEGER,
    "horasSemana" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanMateria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prerrequisito" (
    "id" SERIAL NOT NULL,
    "planMateriaId" INTEGER NOT NULL,
    "requierePlanMateriaId" INTEGER NOT NULL,
    "obligatorio" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Prerrequisito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CicloEscolar" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoCiclo" NOT NULL DEFAULT 'PLANEACION',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CicloEscolar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodoEvaluacion" (
    "id" SERIAL NOT NULL,
    "cicloId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "peso" DECIMAL(6,3) NOT NULL DEFAULT 1,
    "capturaAbierta" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PeriodoEvaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grupo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "cicloId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "gradoId" INTEGER NOT NULL,
    "plantelId" INTEGER,
    "turnoId" INTEGER,
    "aulaId" INTEGER,
    "cupoMaximo" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "usuario" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "debeCambiarPassword" BOOLEAN NOT NULL DEFAULT false,
    "ultimoAcceso" TIMESTAMP(3),
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "googleId" TEXT,
    "twoFactorSecret" TEXT,
    "twoFactorActivo" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sesion" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "revocada" BOOLEAN NOT NULL DEFAULT false,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alumno" (
    "id" SERIAL NOT NULL,
    "matricula" TEXT NOT NULL,
    "usuarioId" INTEGER,
    "nombres" TEXT NOT NULL,
    "apellidoPaterno" TEXT NOT NULL,
    "apellidoMaterno" TEXT,
    "curp" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "sexo" TEXT,
    "fotoUrl" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "estadoDireccion" TEXT,
    "codigoPostal" TEXT,
    "planId" INTEGER NOT NULL,
    "plantelId" INTEGER,
    "turnoId" INTEGER,
    "estado" "EstadoAlumno" NOT NULL DEFAULT 'ACTIVO',
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaBaja" TIMESTAMP(3),
    "motivoBaja" TEXT,
    "tipoSangre" TEXT,
    "alergias" TEXT,
    "padecimientos" TEXT,
    "seguroMedico" TEXT,
    "numeroSeguro" TEXT,
    "rfcFacturacion" TEXT,
    "razonSocialFacturacion" TEXT,
    "usoCfdiPreferido" TEXT,
    "promedioGeneral" DECIMAL(6,3),
    "tieneAdeudo" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alumno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tutor" (
    "id" SERIAL NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "parentesco" TEXT,
    "telefono" TEXT,
    "telefonoAlterno" TEXT,
    "email" TEXT,
    "ocupacion" TEXT,
    "esResponsableFinanciero" BOOLEAN NOT NULL DEFAULT false,
    "esContactoEmergencia" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Tutor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empleado" (
    "id" SERIAL NOT NULL,
    "numeroEmpleado" TEXT NOT NULL,
    "usuarioId" INTEGER,
    "nombres" TEXT NOT NULL,
    "apellidoPaterno" TEXT NOT NULL,
    "apellidoMaterno" TEXT,
    "esDocente" BOOLEAN NOT NULL DEFAULT true,
    "puesto" TEXT,
    "gradoAcademico" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "fotoUrl" TEXT,
    "rfc" TEXT,
    "curp" TEXT,
    "nss" TEXT,
    "tipoContrato" "TipoContrato",
    "salarioBase" DECIMAL(12,2),
    "pagoPorHora" DECIMAL(12,2),
    "periodicidadPago" "Periodicidad" DEFAULT 'MENSUAL',
    "banco" TEXT,
    "cuentaBancaria" TEXT,
    "clabe" TEXT,
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaBaja" TIMESTAMP(3),
    "estado" "EstadoEmpleado" NOT NULL DEFAULT 'ACTIVO',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoDocumento" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "aplicaA" "TipoEntidadExpediente" NOT NULL,
    "obligatorio" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TipoDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoExpediente" (
    "id" SERIAL NOT NULL,
    "tipoEntidad" "TipoEntidadExpediente" NOT NULL,
    "alumnoId" INTEGER,
    "empleadoId" INTEGER,
    "tipoDocumentoId" INTEGER,
    "nombre" TEXT NOT NULL,
    "archivoUrl" TEXT,
    "entregado" BOOLEAN NOT NULL DEFAULT false,
    "fechaEntrega" TIMESTAMP(3),
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoExpediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscripcion" (
    "id" SERIAL NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "cicloId" INTEGER NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "gradoId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoInscripcion" NOT NULL DEFAULT 'INSCRITO',
    "observaciones" TEXT,

    CONSTRAINT "Inscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clase" (
    "id" SERIAL NOT NULL,
    "cicloId" INTEGER NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "planMateriaId" INTEGER NOT NULL,
    "docenteId" INTEGER NOT NULL,
    "aulaId" INTEGER,
    "escalaId" INTEGER,
    "modoAsistencia" "ModoAsistencia" NOT NULL DEFAULT 'POR_CLASE',
    "asistenciaAfectaCalificacion" BOOLEAN NOT NULL DEFAULT false,
    "porcentajeAsistencia" DECIMAL(5,2),
    "cerrada" BOOLEAN NOT NULL DEFAULT false,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorarioClase" (
    "id" SERIAL NOT NULL,
    "claseId" INTEGER NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "moduloId" INTEGER,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "aulaId" INTEGER,

    CONSTRAINT "HorarioClase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlumnoClase" (
    "id" SERIAL NOT NULL,
    "claseId" INTEGER NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "tipo" "TipoInscripcionClase" NOT NULL DEFAULT 'REGULAR',
    "estado" "EstadoMateriaAlumno" NOT NULL DEFAULT 'EN_CURSO',
    "calificacionFinal" DECIMAL(6,3),
    "fechaInscripcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlumnoClase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalaCalificacion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoEscala" NOT NULL DEFAULT 'NUMERICA',
    "valorMinimo" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "valorMaximo" DECIMAL(6,3) NOT NULL DEFAULT 100,
    "decimales" INTEGER NOT NULL DEFAULT 2,
    "redondeo" "ModoRedondeo" NOT NULL DEFAULT 'NINGUNO',
    "minimaAprobatoria" DECIMAL(6,3) NOT NULL DEFAULT 70,
    "predeterminada" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EscalaCalificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RangoEscala" (
    "id" SERIAL NOT NULL,
    "escalaId" INTEGER NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "valorMin" DECIMAL(6,3) NOT NULL,
    "valorMax" DECIMAL(6,3) NOT NULL,
    "aprueba" BOOLEAN NOT NULL DEFAULT true,
    "descripcion" TEXT,

    CONSTRAINT "RangoEscala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubroEvaluacion" (
    "id" SERIAL NOT NULL,
    "claseId" INTEGER NOT NULL,
    "periodoId" INTEGER,
    "nombre" TEXT NOT NULL,
    "peso" DECIMAL(6,3) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RubroEvaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actividad" (
    "id" SERIAL NOT NULL,
    "claseId" INTEGER NOT NULL,
    "rubroId" INTEGER,
    "periodoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "puntosMaximos" DECIMAL(6,3) NOT NULL DEFAULT 100,
    "fechaAsignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEntrega" TIMESTAMP(3),
    "publicada" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalificacionActividad" (
    "id" SERIAL NOT NULL,
    "actividadId" INTEGER NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "puntos" DECIMAL(6,3),
    "entregada" BOOLEAN NOT NULL DEFAULT true,
    "comentario" TEXT,
    "capturadoPor" INTEGER,
    "fechaCaptura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalificacionActividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalificacionPeriodo" (
    "id" SERIAL NOT NULL,
    "claseId" INTEGER NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "periodoId" INTEGER NOT NULL,
    "calificacion" DECIMAL(6,3),
    "origen" "OrigenCalificacion" NOT NULL DEFAULT 'MANUAL',
    "observaciones" TEXT,
    "faltas" INTEGER NOT NULL DEFAULT 0,
    "cerrada" BOOLEAN NOT NULL DEFAULT false,
    "capturadoPor" INTEGER,
    "fechaCaptura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalificacionPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluacionExtraordinaria" (
    "id" SERIAL NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "claseId" INTEGER NOT NULL,
    "tipo" "TipoEvaluacionExtra" NOT NULL DEFAULT 'EXTRAORDINARIO',
    "calificacion" DECIMAL(6,3) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aplicadoPor" INTEGER,
    "observaciones" TEXT,

    CONSTRAINT "EvaluacionExtraordinaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromedioCiclo" (
    "id" SERIAL NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "cicloId" INTEGER NOT NULL,
    "promedio" DECIMAL(6,3) NOT NULL,
    "materiasAprobadas" INTEGER NOT NULL DEFAULT 0,
    "materiasReprobadas" INTEGER NOT NULL DEFAULT 0,
    "creditosAprobados" INTEGER NOT NULL DEFAULT 0,
    "posicionRanking" INTEGER,
    "cuadroHonor" BOOLEAN NOT NULL DEFAULT false,
    "calculadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromedioCiclo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SesionAsistencia" (
    "id" SERIAL NOT NULL,
    "claseId" INTEGER,
    "grupoId" INTEGER,
    "docenteId" INTEGER,
    "fecha" DATE NOT NULL,
    "modo" "ModoAsistencia" NOT NULL DEFAULT 'POR_CLASE',
    "cerrada" BOOLEAN NOT NULL DEFAULT false,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SesionAsistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroAsistencia" (
    "id" SERIAL NOT NULL,
    "sesionId" INTEGER NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "estado" "EstadoAsistencia" NOT NULL DEFAULT 'PRESENTE',
    "observacion" TEXT,
    "registradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroAsistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertaAsistencia" (
    "id" SERIAL NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "claseId" INTEGER,
    "faltasConsecutivas" INTEGER NOT NULL,
    "fechaDeteccion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atendida" BOOLEAN NOT NULL DEFAULT false,
    "atendidaPor" INTEGER,
    "notas" TEXT,

    CONSTRAINT "AlertaAsistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptoCobro" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "TipoConceptoCobro" NOT NULL DEFAULT 'OTRO',
    "montoBase" DECIMAL(12,2) NOT NULL,
    "periodicidad" "Periodicidad" NOT NULL DEFAULT 'UNICO',
    "ambito" "AmbitoAplicacion" NOT NULL DEFAULT 'TODOS',
    "referenciaId" INTEGER,
    "diaVencimiento" INTEGER,
    "numeroCargos" INTEGER,
    "obligatorio" BOOLEAN NOT NULL DEFAULT true,
    "generaRecargo" BOOLEAN NOT NULL DEFAULT true,
    "aplicaDescuentos" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "claveProdServSat" TEXT,
    "claveUnidadSat" TEXT,
    "tasaIva" DECIMAL(5,4),

    CONSTRAINT "ConceptoCobro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglaRecargo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoCalculo" "TipoCalculo" NOT NULL DEFAULT 'PORCENTAJE',
    "valor" DECIMAL(12,4) NOT NULL,
    "diasGracia" INTEGER NOT NULL DEFAULT 0,
    "frecuencia" "FrecuenciaRecargo" NOT NULL DEFAULT 'UNICA',
    "topeMaximo" DECIMAL(12,2),
    "aplicaATodos" BOOLEAN NOT NULL DEFAULT true,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReglaRecargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Descuento" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipoCalculo" "TipoCalculo" NOT NULL DEFAULT 'PORCENTAJE',
    "valor" DECIMAL(12,4) NOT NULL,
    "acumulable" BOOLEAN NOT NULL DEFAULT false,
    "requiereAutorizacion" BOOLEAN NOT NULL DEFAULT true,
    "aplicaATodos" BOOLEAN NOT NULL DEFAULT false,
    "vigenciaInicio" TIMESTAMP(3),
    "vigenciaFin" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Descuento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DescuentoAlumno" (
    "id" SERIAL NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "descuentoId" INTEGER NOT NULL,
    "cicloId" INTEGER,
    "autorizadoPor" INTEGER,
    "fechaAutorizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenciaInicio" TIMESTAMP(3),
    "vigenciaFin" TIMESTAMP(3),
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DescuentoAlumno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cargo" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "conceptoId" INTEGER,
    "cicloId" INTEGER,
    "convenioId" INTEGER,
    "descripcion" TEXT NOT NULL,
    "montoOriginal" DECIMAL(12,2) NOT NULL,
    "montoDescuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "montoRecargo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "montoTotal" DECIMAL(12,2) NOT NULL,
    "saldo" DECIMAL(12,2) NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoCargo" NOT NULL DEFAULT 'PENDIENTE',
    "generadoAutomatico" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "creadoPor" INTEGER,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montoTotal" DECIMAL(12,2) NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO',
    "referencia" TEXT,
    "banco" TEXT,
    "estado" "EstadoPago" NOT NULL DEFAULT 'REGISTRADO',
    "registradoPor" INTEGER,
    "pasarela" "ProveedorPasarela",
    "idTransaccionExterna" TEXT,
    "notas" TEXT,
    "canceladoEn" TIMESTAMP(3),
    "canceladoPor" INTEGER,
    "motivoCancelacion" TEXT,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AplicacionPago" (
    "id" SERIAL NOT NULL,
    "pagoId" INTEGER NOT NULL,
    "cargoId" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "AplicacionPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recibo" (
    "id" SERIAL NOT NULL,
    "pagoId" INTEGER NOT NULL,
    "serie" TEXT NOT NULL DEFAULT 'A',
    "folio" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "impuestos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "archivoPdf" TEXT,
    "estadoCfdi" "EstadoCfdi" NOT NULL DEFAULT 'NO_APLICA',
    "uuidCfdi" TEXT,
    "rfcEmisor" TEXT,
    "rfcReceptor" TEXT,
    "razonSocialReceptor" TEXT,
    "regimenFiscalReceptor" TEXT,
    "domicilioFiscalReceptor" TEXT,
    "usoCfdi" TEXT,
    "formaPagoSat" TEXT,
    "metodoPagoSat" TEXT,
    "xmlUrl" TEXT,
    "errorTimbrado" TEXT,

    CONSTRAINT "Recibo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConvenioPago" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "numeroParcialidades" INTEGER NOT NULL,
    "montoTotal" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoConvenio" NOT NULL DEFAULT 'VIGENTE',
    "autorizadoPor" INTEGER,
    "notas" TEXT,

    CONSTRAINT "ConvenioPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcialidadConvenio" (
    "id" SERIAL NOT NULL,
    "convenioId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "pagada" BOOLEAN NOT NULL DEFAULT false,
    "cargoId" INTEGER,

    CONSTRAINT "ParcialidadConvenio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionPasarela" (
    "id" SERIAL NOT NULL,
    "proveedor" "ProveedorPasarela" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "modo" "ModoPasarela" NOT NULL DEFAULT 'SANDBOX',
    "credenciales" JSONB,
    "comisionPorcentaje" DECIMAL(5,2),
    "notas" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionPasarela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptoNomina" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoConceptoNomina" NOT NULL,
    "tipoCalculo" "TipoCalculo" NOT NULL DEFAULT 'FIJO',
    "valor" DECIMAL(12,4),
    "gravable" BOOLEAN NOT NULL DEFAULT true,
    "claveSat" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ConceptoNomina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodoNomina" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoPeriodoNomina" NOT NULL DEFAULT 'ABIERTO',
    "cerradoPor" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodoNomina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReciboNomina" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "periodoId" INTEGER NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "totalPercepciones" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDeducciones" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "neto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" "EstadoReciboNomina" NOT NULL DEFAULT 'BORRADOR',
    "metodoPago" "MetodoPago",
    "fechaPago" TIMESTAMP(3),
    "observaciones" TEXT,

    CONSTRAINT "ReciboNomina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleReciboNomina" (
    "id" SERIAL NOT NULL,
    "reciboId" INTEGER NOT NULL,
    "conceptoId" INTEGER NOT NULL,
    "cantidad" DECIMAL(12,4),
    "importe" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "DetalleReciboNomina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL DEFAULT 'INFORMATIVA',
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "url" TEXT,
    "datos" JSONB,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aviso" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "ambito" "AmbitoAplicacion" NOT NULL DEFAULT 'TODOS',
    "referenciaId" INTEGER,
    "dirigidoA" TEXT[],
    "publicadoPor" INTEGER,
    "fechaPublicacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenciaHasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Aviso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bitacora" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER,
    "accion" "AccionBitacora" NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "descripcion" TEXT,
    "datosAntes" JSONB,
    "datosDespues" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bitacora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportacionCsv" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "totalRegistros" INTEGER NOT NULL DEFAULT 0,
    "exitosos" INTEGER NOT NULL DEFAULT 0,
    "fallidos" INTEGER NOT NULL DEFAULT 0,
    "errores" JSONB,
    "usuarioId" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportacionCsv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ConceptosConRecargo" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ConceptosConRecargo_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ConceptosConDescuento" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ConceptosConDescuento_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Configuracion_clave_key" ON "Configuracion"("clave");

-- CreateIndex
CREATE INDEX "Configuracion_categoria_idx" ON "Configuracion"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "Plantel_clave_key" ON "Plantel"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "Turno_nombre_key" ON "Turno"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Aula_plantelId_nombre_key" ON "Aula"("plantelId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "NivelEducativo_nombre_key" ON "NivelEducativo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "NivelEducativo_clave_key" ON "NivelEducativo"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEstudios_clave_key" ON "PlanEstudios"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "Grado_planId_numero_key" ON "Grado"("planId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Area_nombre_key" ON "Area"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Materia_clave_key" ON "Materia"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "PlanMateria_planId_gradoId_materiaId_key" ON "PlanMateria"("planId", "gradoId", "materiaId");

-- CreateIndex
CREATE UNIQUE INDEX "Prerrequisito_planMateriaId_requierePlanMateriaId_key" ON "Prerrequisito"("planMateriaId", "requierePlanMateriaId");

-- CreateIndex
CREATE UNIQUE INDEX "CicloEscolar_clave_key" ON "CicloEscolar"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodoEvaluacion_cicloId_numero_key" ON "PeriodoEvaluacion"("cicloId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Grupo_cicloId_nombre_key" ON "Grupo"("cicloId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_usuario_key" ON "Usuario"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_googleId_key" ON "Usuario"("googleId");

-- CreateIndex
CREATE INDEX "Usuario_rol_activo_idx" ON "Usuario"("rol", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Sesion_token_key" ON "Sesion"("token");

-- CreateIndex
CREATE INDEX "Sesion_usuarioId_idx" ON "Sesion"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Alumno_matricula_key" ON "Alumno"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "Alumno_usuarioId_key" ON "Alumno"("usuarioId");

-- CreateIndex
CREATE INDEX "Alumno_estado_planId_idx" ON "Alumno"("estado", "planId");

-- CreateIndex
CREATE INDEX "Alumno_apellidoPaterno_nombres_idx" ON "Alumno"("apellidoPaterno", "nombres");

-- CreateIndex
CREATE INDEX "Tutor_alumnoId_idx" ON "Tutor"("alumnoId");

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_numeroEmpleado_key" ON "Empleado"("numeroEmpleado");

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_usuarioId_key" ON "Empleado"("usuarioId");

-- CreateIndex
CREATE INDEX "Empleado_esDocente_estado_idx" ON "Empleado"("esDocente", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "TipoDocumento_nombre_aplicaA_key" ON "TipoDocumento"("nombre", "aplicaA");

-- CreateIndex
CREATE INDEX "Inscripcion_grupoId_idx" ON "Inscripcion"("grupoId");

-- CreateIndex
CREATE UNIQUE INDEX "Inscripcion_alumnoId_cicloId_key" ON "Inscripcion"("alumnoId", "cicloId");

-- CreateIndex
CREATE INDEX "Clase_docenteId_idx" ON "Clase"("docenteId");

-- CreateIndex
CREATE UNIQUE INDEX "Clase_cicloId_grupoId_planMateriaId_key" ON "Clase"("cicloId", "grupoId", "planMateriaId");

-- CreateIndex
CREATE INDEX "HorarioClase_diaSemana_idx" ON "HorarioClase"("diaSemana");

-- CreateIndex
CREATE INDEX "AlumnoClase_alumnoId_idx" ON "AlumnoClase"("alumnoId");

-- CreateIndex
CREATE UNIQUE INDEX "AlumnoClase_claseId_alumnoId_key" ON "AlumnoClase"("claseId", "alumnoId");

-- CreateIndex
CREATE UNIQUE INDEX "EscalaCalificacion_nombre_key" ON "EscalaCalificacion"("nombre");

-- CreateIndex
CREATE INDEX "RubroEvaluacion_claseId_idx" ON "RubroEvaluacion"("claseId");

-- CreateIndex
CREATE INDEX "Actividad_claseId_periodoId_idx" ON "Actividad"("claseId", "periodoId");

-- CreateIndex
CREATE UNIQUE INDEX "CalificacionActividad_actividadId_alumnoId_key" ON "CalificacionActividad"("actividadId", "alumnoId");

-- CreateIndex
CREATE INDEX "CalificacionPeriodo_alumnoId_idx" ON "CalificacionPeriodo"("alumnoId");

-- CreateIndex
CREATE UNIQUE INDEX "CalificacionPeriodo_claseId_alumnoId_periodoId_key" ON "CalificacionPeriodo"("claseId", "alumnoId", "periodoId");

-- CreateIndex
CREATE INDEX "EvaluacionExtraordinaria_alumnoId_idx" ON "EvaluacionExtraordinaria"("alumnoId");

-- CreateIndex
CREATE UNIQUE INDEX "PromedioCiclo_alumnoId_cicloId_key" ON "PromedioCiclo"("alumnoId", "cicloId");

-- CreateIndex
CREATE INDEX "SesionAsistencia_fecha_idx" ON "SesionAsistencia"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "SesionAsistencia_claseId_fecha_key" ON "SesionAsistencia"("claseId", "fecha");

-- CreateIndex
CREATE INDEX "RegistroAsistencia_alumnoId_estado_idx" ON "RegistroAsistencia"("alumnoId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroAsistencia_sesionId_alumnoId_key" ON "RegistroAsistencia"("sesionId", "alumnoId");

-- CreateIndex
CREATE INDEX "AlertaAsistencia_atendida_idx" ON "AlertaAsistencia"("atendida");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptoCobro_clave_key" ON "ConceptoCobro"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "DescuentoAlumno_alumnoId_descuentoId_cicloId_key" ON "DescuentoAlumno"("alumnoId", "descuentoId", "cicloId");

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_folio_key" ON "Cargo"("folio");

-- CreateIndex
CREATE INDEX "Cargo_alumnoId_estado_idx" ON "Cargo"("alumnoId", "estado");

-- CreateIndex
CREATE INDEX "Cargo_fechaVencimiento_estado_idx" ON "Cargo"("fechaVencimiento", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_folio_key" ON "Pago"("folio");

-- CreateIndex
CREATE INDEX "Pago_alumnoId_fecha_idx" ON "Pago"("alumnoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "AplicacionPago_pagoId_cargoId_key" ON "AplicacionPago"("pagoId", "cargoId");

-- CreateIndex
CREATE UNIQUE INDEX "Recibo_pagoId_key" ON "Recibo"("pagoId");

-- CreateIndex
CREATE UNIQUE INDEX "Recibo_serie_folio_key" ON "Recibo"("serie", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "ConvenioPago_folio_key" ON "ConvenioPago"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "ParcialidadConvenio_cargoId_key" ON "ParcialidadConvenio"("cargoId");

-- CreateIndex
CREATE UNIQUE INDEX "ParcialidadConvenio_convenioId_numero_key" ON "ParcialidadConvenio"("convenioId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracionPasarela_proveedor_key" ON "ConfiguracionPasarela"("proveedor");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptoNomina_clave_key" ON "ConceptoNomina"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodoNomina_fechaInicio_fechaFin_key" ON "PeriodoNomina"("fechaInicio", "fechaFin");

-- CreateIndex
CREATE UNIQUE INDEX "ReciboNomina_folio_key" ON "ReciboNomina"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "ReciboNomina_periodoId_empleadoId_key" ON "ReciboNomina"("periodoId", "empleadoId");

-- CreateIndex
CREATE INDEX "Notificacion_usuarioId_leida_idx" ON "Notificacion"("usuarioId", "leida");

-- CreateIndex
CREATE INDEX "Bitacora_entidad_entidadId_idx" ON "Bitacora"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "Bitacora_fecha_idx" ON "Bitacora"("fecha");

-- CreateIndex
CREATE INDEX "_ConceptosConRecargo_B_index" ON "_ConceptosConRecargo"("B");

-- CreateIndex
CREATE INDEX "_ConceptosConDescuento_B_index" ON "_ConceptosConDescuento"("B");

-- AddForeignKey
ALTER TABLE "Aula" ADD CONSTRAINT "Aula_plantelId_fkey" FOREIGN KEY ("plantelId") REFERENCES "Plantel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEstudios" ADD CONSTRAINT "PlanEstudios_nivelId_fkey" FOREIGN KEY ("nivelId") REFERENCES "NivelEducativo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grado" ADD CONSTRAINT "Grado_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlanEstudios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Materia" ADD CONSTRAINT "Materia_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMateria" ADD CONSTRAINT "PlanMateria_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlanEstudios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMateria" ADD CONSTRAINT "PlanMateria_gradoId_fkey" FOREIGN KEY ("gradoId") REFERENCES "Grado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMateria" ADD CONSTRAINT "PlanMateria_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prerrequisito" ADD CONSTRAINT "Prerrequisito_planMateriaId_fkey" FOREIGN KEY ("planMateriaId") REFERENCES "PlanMateria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prerrequisito" ADD CONSTRAINT "Prerrequisito_requierePlanMateriaId_fkey" FOREIGN KEY ("requierePlanMateriaId") REFERENCES "PlanMateria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodoEvaluacion" ADD CONSTRAINT "PeriodoEvaluacion_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "CicloEscolar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "CicloEscolar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlanEstudios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_gradoId_fkey" FOREIGN KEY ("gradoId") REFERENCES "Grado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_plantelId_fkey" FOREIGN KEY ("plantelId") REFERENCES "Plantel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "Aula"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alumno" ADD CONSTRAINT "Alumno_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alumno" ADD CONSTRAINT "Alumno_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlanEstudios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alumno" ADD CONSTRAINT "Alumno_plantelId_fkey" FOREIGN KEY ("plantelId") REFERENCES "Plantel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alumno" ADD CONSTRAINT "Alumno_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tutor" ADD CONSTRAINT "Tutor_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoExpediente" ADD CONSTRAINT "DocumentoExpediente_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoExpediente" ADD CONSTRAINT "DocumentoExpediente_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoExpediente" ADD CONSTRAINT "DocumentoExpediente_tipoDocumentoId_fkey" FOREIGN KEY ("tipoDocumentoId") REFERENCES "TipoDocumento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "CicloEscolar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_gradoId_fkey" FOREIGN KEY ("gradoId") REFERENCES "Grado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clase" ADD CONSTRAINT "Clase_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "CicloEscolar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clase" ADD CONSTRAINT "Clase_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clase" ADD CONSTRAINT "Clase_planMateriaId_fkey" FOREIGN KEY ("planMateriaId") REFERENCES "PlanMateria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clase" ADD CONSTRAINT "Clase_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clase" ADD CONSTRAINT "Clase_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "Aula"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clase" ADD CONSTRAINT "Clase_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "EscalaCalificacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorarioClase" ADD CONSTRAINT "HorarioClase_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorarioClase" ADD CONSTRAINT "HorarioClase_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "ModuloHorario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorarioClase" ADD CONSTRAINT "HorarioClase_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "Aula"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlumnoClase" ADD CONSTRAINT "AlumnoClase_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlumnoClase" ADD CONSTRAINT "AlumnoClase_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RangoEscala" ADD CONSTRAINT "RangoEscala_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "EscalaCalificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubroEvaluacion" ADD CONSTRAINT "RubroEvaluacion_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubroEvaluacion" ADD CONSTRAINT "RubroEvaluacion_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoEvaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_rubroId_fkey" FOREIGN KEY ("rubroId") REFERENCES "RubroEvaluacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoEvaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalificacionActividad" ADD CONSTRAINT "CalificacionActividad_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "Actividad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalificacionActividad" ADD CONSTRAINT "CalificacionActividad_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalificacionPeriodo" ADD CONSTRAINT "CalificacionPeriodo_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalificacionPeriodo" ADD CONSTRAINT "CalificacionPeriodo_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalificacionPeriodo" ADD CONSTRAINT "CalificacionPeriodo_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoEvaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluacionExtraordinaria" ADD CONSTRAINT "EvaluacionExtraordinaria_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluacionExtraordinaria" ADD CONSTRAINT "EvaluacionExtraordinaria_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromedioCiclo" ADD CONSTRAINT "PromedioCiclo_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromedioCiclo" ADD CONSTRAINT "PromedioCiclo_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "CicloEscolar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionAsistencia" ADD CONSTRAINT "SesionAsistencia_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionAsistencia" ADD CONSTRAINT "SesionAsistencia_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionAsistencia" ADD CONSTRAINT "SesionAsistencia_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAsistencia" ADD CONSTRAINT "RegistroAsistencia_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "SesionAsistencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAsistencia" ADD CONSTRAINT "RegistroAsistencia_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaAsistencia" ADD CONSTRAINT "AlertaAsistencia_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaAsistencia" ADD CONSTRAINT "AlertaAsistencia_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DescuentoAlumno" ADD CONSTRAINT "DescuentoAlumno_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DescuentoAlumno" ADD CONSTRAINT "DescuentoAlumno_descuentoId_fkey" FOREIGN KEY ("descuentoId") REFERENCES "Descuento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DescuentoAlumno" ADD CONSTRAINT "DescuentoAlumno_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "CicloEscolar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "ConceptoCobro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "CicloEscolar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "ConvenioPago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacionPago" ADD CONSTRAINT "AplicacionPago_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacionPago" ADD CONSTRAINT "AplicacionPago_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recibo" ADD CONSTRAINT "Recibo_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvenioPago" ADD CONSTRAINT "ConvenioPago_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcialidadConvenio" ADD CONSTRAINT "ParcialidadConvenio_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "ConvenioPago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcialidadConvenio" ADD CONSTRAINT "ParcialidadConvenio_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReciboNomina" ADD CONSTRAINT "ReciboNomina_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoNomina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReciboNomina" ADD CONSTRAINT "ReciboNomina_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleReciboNomina" ADD CONSTRAINT "DetalleReciboNomina_reciboId_fkey" FOREIGN KEY ("reciboId") REFERENCES "ReciboNomina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleReciboNomina" ADD CONSTRAINT "DetalleReciboNomina_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "ConceptoNomina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bitacora" ADD CONSTRAINT "Bitacora_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConceptosConRecargo" ADD CONSTRAINT "_ConceptosConRecargo_A_fkey" FOREIGN KEY ("A") REFERENCES "ConceptoCobro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConceptosConRecargo" ADD CONSTRAINT "_ConceptosConRecargo_B_fkey" FOREIGN KEY ("B") REFERENCES "ReglaRecargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConceptosConDescuento" ADD CONSTRAINT "_ConceptosConDescuento_A_fkey" FOREIGN KEY ("A") REFERENCES "ConceptoCobro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConceptosConDescuento" ADD CONSTRAINT "_ConceptosConDescuento_B_fkey" FOREIGN KEY ("B") REFERENCES "Descuento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
