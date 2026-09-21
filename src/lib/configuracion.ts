import { cache } from "react";
import type { TipoConfiguracion } from "@prisma/client";
import { db } from "./db";
import { registrarBitacora } from "./bitacora";

export type DefinicionConfig = {
  clave: string;
  valor: string;
  tipo: TipoConfiguracion;
  categoria: string;
  etiqueta: string;
  descripcion?: string;
  opciones?: string[];
  editable?: boolean;
  orden?: number;
};

/// Catalogo maestro de parametros. Cada escuela ajusta estos valores
/// desde el asistente de instalacion o desde Configuracion del sistema.
/// Agregar una entrada aqui la hace aparecer automaticamente en la UI.
export const CATALOGO_CONFIGURACION: DefinicionConfig[] = [
  // ---------------- Academico ----------------
  { clave: "academico.plantilla_matricula", valor: "{ANIO}-{CONSECUTIVO:4}", tipo: "TEXTO", categoria: "academico", etiqueta: "Plantilla de matricula", descripcion: "Comodines disponibles: {ANIO}, {ANIO2}, {NIVEL}, {PLAN}, {CONSECUTIVO:n}", orden: 1 },
  { clave: "academico.permite_multiples_ciclos", valor: "true", tipo: "BOOLEANO", categoria: "academico", etiqueta: "Permitir varios ciclos activos a la vez", descripcion: "Util para cursos de verano o intersemestrales simultaneos al ciclo regular.", orden: 2 },
  { clave: "academico.exige_prerrequisitos", valor: "true", tipo: "BOOLEANO", categoria: "academico", etiqueta: "Validar materias prerrequisito", descripcion: "Impide inscribir una materia si la materia requerida no esta aprobada.", orden: 3 },
  { clave: "academico.permite_optativas", valor: "true", tipo: "BOOLEANO", categoria: "academico", etiqueta: "Permitir materias optativas", orden: 4 },
  { clave: "academico.permite_recursamiento", valor: "true", tipo: "BOOLEANO", categoria: "academico", etiqueta: "Permitir recursamiento de materias reprobadas", orden: 5 },
  { clave: "academico.nombre_grupo_sugerido", valor: "{GRADO}{LETRA}", tipo: "TEXTO", categoria: "academico", etiqueta: "Sugerencia de nombre de grupo", descripcion: "Solo es una sugerencia: el nombre final siempre lo escribe la escuela.", orden: 6 },

  // ---------------- Evaluacion ----------------
  { clave: "evaluacion.docente_define_rubros", valor: "true", tipo: "BOOLEANO", categoria: "evaluacion", etiqueta: "El docente define sus rubros y ponderaciones", descripcion: "Si se desactiva, solo la direccion puede configurar los rubros de cada clase.", orden: 1 },
  { clave: "evaluacion.suma_pesos_debe_ser_100", valor: "true", tipo: "BOOLEANO", categoria: "evaluacion", etiqueta: "Exigir que los pesos sumen 100%", orden: 2 },
  { clave: "evaluacion.permite_extraordinario", valor: "true", tipo: "BOOLEANO", categoria: "evaluacion", etiqueta: "Permitir examenes extraordinarios", orden: 3 },
  { clave: "evaluacion.calificacion_maxima_extraordinario", valor: "100", tipo: "NUMERO", categoria: "evaluacion", etiqueta: "Calificacion maxima en extraordinario", orden: 4 },
  { clave: "evaluacion.cuadro_honor_promedio_minimo", valor: "95", tipo: "NUMERO", categoria: "evaluacion", etiqueta: "Promedio minimo para cuadro de honor", orden: 5 },
  { clave: "evaluacion.publicar_calificaciones_alumno", valor: "true", tipo: "BOOLEANO", categoria: "evaluacion", etiqueta: "El alumno ve sus calificaciones en su portal", orden: 6 },
  { clave: "evaluacion.bloquear_captura_fuera_de_periodo", valor: "true", tipo: "BOOLEANO", categoria: "evaluacion", etiqueta: "Bloquear captura fuera de las fechas del periodo", orden: 7 },

  // ---------------- Asistencia ----------------
  { clave: "asistencia.docente_decide_modo", valor: "true", tipo: "BOOLEANO", categoria: "asistencia", etiqueta: "Cada docente elige como pasa lista", descripcion: "Por dia o por clase, desde su propio portal.", orden: 1 },
  { clave: "asistencia.modo_predeterminado", valor: "POR_CLASE", tipo: "OPCION", categoria: "asistencia", etiqueta: "Modo predeterminado", opciones: ["POR_DIA", "POR_CLASE"], orden: 2 },
  { clave: "asistencia.docente_decide_afectacion", valor: "true", tipo: "BOOLEANO", categoria: "asistencia", etiqueta: "Cada docente decide si la asistencia afecta la calificacion", orden: 3 },
  { clave: "asistencia.faltas_consecutivas_alerta", valor: "3", tipo: "NUMERO", categoria: "asistencia", etiqueta: "Faltas consecutivas que disparan alerta", descripcion: "Al alcanzarse, el sistema notifica a los administrativos.", orden: 4 },
  { clave: "asistencia.retardos_equivalen_falta", valor: "3", tipo: "NUMERO", categoria: "asistencia", etiqueta: "Retardos que equivalen a una falta", descripcion: "Usa 0 para desactivar la equivalencia.", orden: 5 },
  { clave: "asistencia.porcentaje_minimo", valor: "0", tipo: "NUMERO", categoria: "asistencia", etiqueta: "Porcentaje minimo de asistencia", descripcion: "0 desactiva la validacion.", orden: 6 },

  // ---------------- Horarios ----------------
  { clave: "horarios.dias_habiles", valor: "[1,2,3,4,5]", tipo: "JSON", categoria: "horarios", etiqueta: "Dias habiles", descripcion: "1 = lunes ... 7 = domingo", orden: 1 },
  { clave: "horarios.duracion_modulo_minutos", valor: "50", tipo: "NUMERO", categoria: "horarios", etiqueta: "Duracion de cada modulo (minutos)", orden: 2 },
  { clave: "horarios.validar_choque_docente", valor: "true", tipo: "BOOLEANO", categoria: "horarios", etiqueta: "Impedir que un docente este en dos clases a la vez", orden: 3 },
  { clave: "horarios.validar_choque_aula", valor: "true", tipo: "BOOLEANO", categoria: "horarios", etiqueta: "Impedir que un aula se use en dos clases a la vez", orden: 4 },
  { clave: "horarios.validar_choque_grupo", valor: "true", tipo: "BOOLEANO", categoria: "horarios", etiqueta: "Impedir traslapes en el horario de un grupo", orden: 5 },

  // ---------------- Finanzas ----------------
  { clave: "finanzas.dia_vencimiento_default", valor: "10", tipo: "NUMERO", categoria: "finanzas", etiqueta: "Dia de vencimiento predeterminado", descripcion: "Dia del mes en que vencen las colegiaturas.", orden: 1 },
  { clave: "finanzas.genera_cargos_automaticos", valor: "true", tipo: "BOOLEANO", categoria: "finanzas", etiqueta: "Generar cargos automaticamente al inscribir", descripcion: "Usa la duracion del plan de estudios para saber cuantos cargos crear.", orden: 2 },
  { clave: "finanzas.permite_pagos_parciales", valor: "true", tipo: "BOOLEANO", categoria: "finanzas", etiqueta: "Permitir pagos parciales", orden: 3 },
  { clave: "finanzas.permite_convenios", valor: "true", tipo: "BOOLEANO", categoria: "finanzas", etiqueta: "Permitir convenios de pago", orden: 4 },
  { clave: "finanzas.descuentos_acumulables", valor: "false", tipo: "BOOLEANO", categoria: "finanzas", etiqueta: "Los descuentos y becas son acumulables", orden: 5 },
  { clave: "finanzas.bloquear_por_adeudo", valor: "false", tipo: "BOOLEANO", categoria: "finanzas", etiqueta: "Bloquear servicios por adeudo", orden: 6 },
  { clave: "finanzas.acciones_bloqueadas_por_adeudo", valor: "[\"BOLETA\",\"REINSCRIPCION\"]", tipo: "JSON", categoria: "finanzas", etiqueta: "Que se bloquea al tener adeudo", descripcion: "Opciones: BOLETA, REINSCRIPCION, PORTAL, CONSTANCIAS", orden: 7 },
  { clave: "finanzas.dias_adeudo_para_bloqueo", valor: "30", tipo: "NUMERO", categoria: "finanzas", etiqueta: "Dias de atraso antes de bloquear", orden: 8 },
  { clave: "finanzas.plantilla_folio_cargo", valor: "C-{ANIO}-{CONSECUTIVO:6}", tipo: "TEXTO", categoria: "finanzas", etiqueta: "Plantilla de folio de cargo", orden: 9 },
  { clave: "finanzas.plantilla_folio_pago", valor: "P-{ANIO}-{CONSECUTIVO:6}", tipo: "TEXTO", categoria: "finanzas", etiqueta: "Plantilla de folio de pago", orden: 10 },
  { clave: "finanzas.serie_recibo", valor: "A", tipo: "TEXTO", categoria: "finanzas", etiqueta: "Serie del recibo", orden: 11 },
  { clave: "finanzas.folio_recibo_inicial", valor: "1", tipo: "NUMERO", categoria: "finanzas", etiqueta: "Folio inicial del recibo", orden: 12 },
  { clave: "finanzas.iva_default", valor: "0", tipo: "NUMERO", categoria: "finanzas", etiqueta: "IVA predeterminado (%)", descripcion: "La ensenanza suele estar exenta; se deja configurable.", orden: 13 },
  { clave: "finanzas.cfdi_activo", valor: "false", tipo: "BOOLEANO", categoria: "finanzas", etiqueta: "Timbrado CFDI activo", descripcion: "Requiere conectar un PAC. Mientras este apagado se emite recibo interno.", editable: false, orden: 14 },
  { clave: "finanzas.leyenda_recibo", valor: "Este comprobante no tiene validez fiscal.", tipo: "TEXTO", categoria: "finanzas", etiqueta: "Leyenda al pie del recibo", orden: 15 },

  // ---------------- Portales ----------------
  { clave: "portales.alumno_ve_calificaciones", valor: "true", tipo: "BOOLEANO", categoria: "portales", etiqueta: "Portal del alumno: calificaciones", orden: 1 },
  { clave: "portales.alumno_ve_asistencia", valor: "true", tipo: "BOOLEANO", categoria: "portales", etiqueta: "Portal del alumno: asistencia", orden: 2 },
  { clave: "portales.alumno_ve_horario", valor: "true", tipo: "BOOLEANO", categoria: "portales", etiqueta: "Portal del alumno: horario", orden: 3 },
  { clave: "portales.alumno_ve_estado_cuenta", valor: "true", tipo: "BOOLEANO", categoria: "portales", etiqueta: "Portal del alumno: estado de cuenta", orden: 4 },
  { clave: "portales.alumno_ve_avisos", valor: "true", tipo: "BOOLEANO", categoria: "portales", etiqueta: "Portal del alumno: avisos", orden: 5 },
  { clave: "portales.docente_ve_adeudos", valor: "false", tipo: "BOOLEANO", categoria: "portales", etiqueta: "El docente puede ver adeudos de sus alumnos", orden: 6 },
  { clave: "portales.docente_edita_horario", valor: "false", tipo: "BOOLEANO", categoria: "portales", etiqueta: "El docente puede editar su horario", orden: 7 },

  // ---------------- Expediente ----------------
  { clave: "expediente.exige_curp", valor: "false", tipo: "BOOLEANO", categoria: "expediente", etiqueta: "CURP obligatoria en el alta de alumnos", orden: 1 },
  { clave: "expediente.exige_foto", valor: "false", tipo: "BOOLEANO", categoria: "expediente", etiqueta: "Fotografia obligatoria", orden: 2 },
  { clave: "expediente.usa_documentos", valor: "false", tipo: "BOOLEANO", categoria: "expediente", etiqueta: "Usar control de documentos del expediente", descripcion: "Actas, certificados, comprobantes. Cada escuela decide si lo usa.", orden: 3 },
  { clave: "expediente.campos_medicos_visibles", valor: "true", tipo: "BOOLEANO", categoria: "expediente", etiqueta: "Mostrar datos medicos del alumno", orden: 4 },
  { clave: "expediente.minimo_tutores", valor: "1", tipo: "NUMERO", categoria: "expediente", etiqueta: "Tutores minimos por alumno", orden: 5 },

  // ---------------- Nomina ----------------
  { clave: "nomina.activa", valor: "true", tipo: "BOOLEANO", categoria: "nomina", etiqueta: "Modulo de nomina activo", orden: 1 },
  { clave: "nomina.periodicidad_default", valor: "MENSUAL", tipo: "OPCION", categoria: "nomina", etiqueta: "Periodicidad de pago predeterminada", opciones: ["MENSUAL", "BIMESTRAL", "SEMESTRAL", "ANUAL"], orden: 2 },
  { clave: "nomina.plantilla_folio_recibo", valor: "N-{ANIO}-{CONSECUTIVO:5}", tipo: "TEXTO", categoria: "nomina", etiqueta: "Plantilla de folio del recibo de nomina", orden: 3 },

  // ---------------- Seguridad ----------------
  { clave: "seguridad.longitud_minima_password", valor: "8", tipo: "NUMERO", categoria: "seguridad", etiqueta: "Longitud minima de contrasena", orden: 1 },
  { clave: "seguridad.exigir_2fa_admin", valor: "false", tipo: "BOOLEANO", categoria: "seguridad", etiqueta: "Exigir segundo factor a los administradores", orden: 2 },
  { clave: "seguridad.permitir_google", valor: "false", tipo: "BOOLEANO", categoria: "seguridad", etiqueta: "Permitir acceso con Google", descripcion: "Requiere GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el entorno.", orden: 3 },
  { clave: "seguridad.dominio_google_permitido", valor: "", tipo: "TEXTO", categoria: "seguridad", etiqueta: "Dominio de Google permitido", descripcion: "Por ejemplo micolegio.edu.mx. Vacio acepta cualquiera.", orden: 4 },
  { clave: "seguridad.dias_retencion_bitacora", valor: "1825", tipo: "NUMERO", categoria: "seguridad", etiqueta: "Dias de retencion de la bitacora", orden: 5 },
];

/// Los valores se memorizan por peticion, no en un cache de proceso: asi
/// un cambio hecho en una instancia no deja valores viejos en otra cuando
/// el sistema corre en mas de un proceso o contenedor.
const cargarCache = cache(async (): Promise<Map<string, string>> => {
  const filas = await db.configuracion.findMany();
  const mapa = new Map<string, string>();
  for (const definicion of CATALOGO_CONFIGURACION) mapa.set(definicion.clave, definicion.valor);
  for (const fila of filas) mapa.set(fila.clave, fila.valor);
  return mapa;
});

export async function configTexto(clave: string, respaldo = ""): Promise<string> {
  const mapa = await cargarCache();
  return mapa.get(clave) ?? respaldo;
}

export async function configNumero(clave: string, respaldo = 0): Promise<number> {
  const valor = Number(await configTexto(clave, String(respaldo)));
  return Number.isFinite(valor) ? valor : respaldo;
}

export async function configBool(clave: string, respaldo = false): Promise<boolean> {
  const valor = await configTexto(clave, respaldo ? "true" : "false");
  return valor === "true" || valor === "1";
}

export async function configJson<T>(clave: string, respaldo: T): Promise<T> {
  try {
    const valor = await configTexto(clave, "");
    return valor ? (JSON.parse(valor) as T) : respaldo;
  } catch {
    return respaldo;
  }
}

/// Crea las llaves faltantes sin pisar las que la escuela ya ajusto.
export async function sembrarConfiguracion(): Promise<number> {
  let creadas = 0;
  for (const definicion of CATALOGO_CONFIGURACION) {
    const existente = await db.configuracion.findUnique({ where: { clave: definicion.clave } });
    if (existente) continue;
    await db.configuracion.create({
      data: {
        clave: definicion.clave,
        valor: definicion.valor,
        tipo: definicion.tipo,
        categoria: definicion.categoria,
        etiqueta: definicion.etiqueta,
        descripcion: definicion.descripcion,
        opciones: definicion.opciones ?? undefined,
        editable: definicion.editable ?? true,
        orden: definicion.orden ?? 0,
      },
    });
    creadas++;
  }
  return creadas;
}

export async function guardarConfig(
  clave: string,
  valor: string,
  usuarioId?: number
): Promise<void> {
  const anterior = await db.configuracion.findUnique({ where: { clave } });
  if (anterior && !anterior.editable) {
    throw new Error(`El parametro ${clave} no es editable desde la interfaz.`);
  }
  const definicion = CATALOGO_CONFIGURACION.find((d) => d.clave === clave);
  await db.configuracion.upsert({
    where: { clave },
    update: { valor },
    create: {
      clave,
      valor,
      tipo: definicion?.tipo ?? "TEXTO",
      categoria: definicion?.categoria ?? "general",
      etiqueta: definicion?.etiqueta ?? clave,
      descripcion: definicion?.descripcion,
      opciones: definicion?.opciones ?? undefined,
      orden: definicion?.orden ?? 0,
    },
  });
  await registrarBitacora({
    usuarioId,
    accion: "CONFIGURAR",
    entidad: "Configuracion",
    entidadId: clave,
    datosAntes: anterior ? { valor: anterior.valor } : undefined,
    datosDespues: { valor },
  });
}

export const ETIQUETAS_CATEGORIA: Record<string, string> = {
  academico: "Academico",
  evaluacion: "Evaluacion y calificaciones",
  asistencia: "Asistencia",
  horarios: "Horarios",
  finanzas: "Finanzas y cobros",
  portales: "Portales",
  expediente: "Expediente",
  nomina: "Nomina",
  seguridad: "Seguridad y acceso",
  general: "General",
};
