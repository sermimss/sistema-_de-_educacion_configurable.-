import type { CategoriaDocumento } from "@prisma/client";
import type { CampoExtra } from "./campos";

/// Machotes con los que arranca cada colegio. Son un punto de partida: el
/// colegio puede cambiar cualquier texto desde Documentos > Machotes, y
/// "Restaurar texto original" vuelve a este.
///
/// Formato del cuerpo:
///   - {{campo}} se reemplaza con el dato real al generar.
///   - Una linea en blanco separa parrafos.
///   - **texto** sale en negritas.
///   - Un parrafo que empieza con [derecha] o [centro] se alinea asi.
///   - {{tabla_calificaciones}} y {{tabla_control_practicas}}, solos en su
///     parrafo, se convierten en tablas.
///   - [firmas]Texto 1 | Texto 2 dibuja lineas para firmar a mano, una por
///     cada texto separado con |.

export type MachoteBase = {
  clave: string;
  nombre: string;
  categoria: CategoriaDocumento;
  descripcion: string;
  titulo: string;
  cuerpo: string;
  camposExtra: CampoExtra[];
  prefijoFolio: string;
  alumnoPuedeSolicitar: boolean;
};

const FECHA = "[derecha]{{documento.ciudad_fecha}}";
const CIERRE_INTERESADO =
  "Se extiende la presente a petición del interesado(a), para los fines legales que a él (ella) convengan.";

export const CATALOGO_DOCUMENTOS: MachoteBase[] = [
  // ---------------- Alumnos ----------------
  {
    clave: "CONSTANCIA_ESTUDIOS",
    nombre: "Constancia de estudios",
    categoria: "ALUMNO",
    descripcion: "Hace constar que el alumno esta inscrito y cursando sus estudios.",
    titulo: "CONSTANCIA DE ESTUDIOS",
    prefijoFolio: "CE",
    alumnoPuedeSolicitar: true,
    camposExtra: [],
    cuerpo: `${FECHA}

**A QUIEN CORRESPONDA:**

Por medio de la presente se hace constar que **{{alumno.nombre_completo}}**, con número de matrícula {{alumno.matricula}} y CURP {{alumno.curp}}, es alumno(a) regular de esta institución, inscrito(a) en el {{alumno.grado}} de {{alumno.plan}}, grupo {{alumno.grupo}}, turno {{alumno.turno}}, en el periodo escolar comprendido del {{alumno.inicio_clases}} al {{alumno.fin_clases}}.

${CIERRE_INTERESADO}`,
  },
  {
    clave: "CONSTANCIA_CALIFICACIONES",
    nombre: "Constancia de estudios con calificaciones",
    categoria: "ALUMNO",
    descripcion: "Constancia de estudios con la tabla de calificaciones del periodo en curso.",
    titulo: "CONSTANCIA DE ESTUDIOS CON CALIFICACIONES",
    prefijoFolio: "CC",
    alumnoPuedeSolicitar: true,
    camposExtra: [],
    cuerpo: `${FECHA}

**A QUIEN CORRESPONDA:**

Por medio de la presente se hace constar que **{{alumno.nombre_completo}}**, con número de matrícula {{alumno.matricula}}, es alumno(a) de esta institución, inscrito(a) en el {{alumno.grado}} de {{alumno.plan}}, grupo {{alumno.grupo}}, y que en el periodo del {{alumno.inicio_clases}} al {{alumno.fin_clases}} ha obtenido las siguientes calificaciones:

{{tabla_calificaciones}}

Promedio general: **{{alumno.promedio_general}}**

${CIERRE_INTERESADO}`,
  },
  {
    clave: "CONSTANCIA_TERMINO",
    nombre: "Constancia de terminacion de estudios",
    categoria: "ALUMNO",
    descripcion: "Hace constar que el alumno concluyo sus estudios.",
    titulo: "CONSTANCIA DE TERMINACIÓN DE ESTUDIOS",
    prefijoFolio: "CT",
    alumnoPuedeSolicitar: true,
    camposExtra: [
      { clave: "fecha_termino", etiqueta: "Fecha en que concluyo sus estudios", tipo: "fecha", requerido: true },
    ],
    cuerpo: `${FECHA}

**A QUIEN CORRESPONDA:**

Por medio de la presente se hace constar que **{{alumno.nombre_completo}}**, con número de matrícula {{alumno.matricula}} y CURP {{alumno.curp}}, concluyó satisfactoriamente sus estudios de {{alumno.plan}} ({{alumno.nivel}}) en esta institución el día {{extra.fecha_termino}}, con un promedio general de **{{alumno.promedio_general}}**.

${CIERRE_INTERESADO}`,
  },
  {
    clave: "CARTA_BUENA_CONDUCTA",
    nombre: "Carta de buena conducta",
    categoria: "ALUMNO",
    descripcion: "Hace constar la buena conducta del alumno en la institucion.",
    titulo: "CARTA DE BUENA CONDUCTA",
    prefijoFolio: "BC",
    alumnoPuedeSolicitar: true,
    camposExtra: [],
    cuerpo: `${FECHA}

**A QUIEN CORRESPONDA:**

Por medio de la presente se hace constar que **{{alumno.nombre_completo}}**, con número de matrícula {{alumno.matricula}}, alumno(a) del {{alumno.grado}} de {{alumno.plan}} en esta institución, ha observado durante su estancia una **buena conducta**, cumpliendo con el reglamento escolar y mostrando respeto hacia sus compañeros, docentes y personal.

${CIERRE_INTERESADO}`,
  },
  {
    clave: "OFICIO_PRACTICAS",
    nombre: "Oficio de presentacion para practicas profesionales",
    categoria: "ALUMNO",
    descripcion: "Presenta al alumno ante la empresa donde hara sus practicas.",
    titulo: "OFICIO DE PRESENTACIÓN PARA PRÁCTICAS PROFESIONALES",
    prefijoFolio: "PP",
    alumnoPuedeSolicitar: true,
    camposExtra: [
      { clave: "destinatario_nombre", etiqueta: "Nombre de quien recibe", tipo: "texto", requerido: true },
      { clave: "destinatario_cargo", etiqueta: "Cargo de quien recibe", tipo: "texto", requerido: true },
      { clave: "empresa", etiqueta: "Empresa o institucion", tipo: "texto", requerido: true },
      { clave: "area", etiqueta: "Area donde las realizara", tipo: "texto", requerido: false },
      { clave: "horas", etiqueta: "Horas que debe cubrir", tipo: "numero", requerido: true },
      { clave: "fecha_inicio", etiqueta: "Fecha de inicio", tipo: "fecha", requerido: true },
    ],
    cuerpo: `[derecha]Oficio No. {{documento.folio}}

${FECHA}

**{{extra.destinatario_nombre}}**
{{extra.destinatario_cargo}}
{{extra.empresa}}
P R E S E N T E

Por medio del presente, me permito presentar a **{{alumno.nombre_completo}}**, con número de matrícula {{alumno.matricula}}, alumno(a) del {{alumno.grado}} de {{alumno.plan}} de esta institución, quien desea realizar sus **prácticas profesionales** en {{extra.empresa}}, en el área de {{extra.area}}, cubriendo un total de {{extra.horas}} horas a partir del {{extra.fecha_inicio}}.

Agradeceremos las facilidades que le brinde para el desarrollo de sus actividades y, en su caso, nos haga llegar la carta de aceptación correspondiente.

Sin otro particular, reciba un cordial saludo.`,
  },
  {
    clave: "OFICIO_SERVICIO_SOCIAL",
    nombre: "Oficio de presentacion para servicio social",
    categoria: "ALUMNO",
    descripcion: "Presenta al alumno ante la dependencia donde prestara su servicio social.",
    titulo: "OFICIO DE PRESENTACIÓN PARA SERVICIO SOCIAL",
    prefijoFolio: "SS",
    alumnoPuedeSolicitar: true,
    camposExtra: [
      { clave: "destinatario_nombre", etiqueta: "Nombre de quien recibe", tipo: "texto", requerido: true },
      { clave: "destinatario_cargo", etiqueta: "Cargo de quien recibe", tipo: "texto", requerido: true },
      { clave: "dependencia", etiqueta: "Dependencia o institucion", tipo: "texto", requerido: true },
      { clave: "programa", etiqueta: "Programa de servicio social", tipo: "texto", requerido: false },
      { clave: "horas", etiqueta: "Horas que debe cubrir", tipo: "numero", requerido: true },
      { clave: "fecha_inicio", etiqueta: "Fecha de inicio", tipo: "fecha", requerido: true },
    ],
    cuerpo: `[derecha]Oficio No. {{documento.folio}}

${FECHA}

**{{extra.destinatario_nombre}}**
{{extra.destinatario_cargo}}
{{extra.dependencia}}
P R E S E N T E

Por medio del presente, me permito presentar a **{{alumno.nombre_completo}}**, con número de matrícula {{alumno.matricula}}, alumno(a) del {{alumno.grado}} de {{alumno.plan}} de esta institución, para que preste su **servicio social** en {{extra.dependencia}}, dentro del programa {{extra.programa}}, cubriendo un total de {{extra.horas}} horas a partir del {{extra.fecha_inicio}}.

Agradeceremos las facilidades que se le otorguen para el cumplimiento de este requisito.

Sin otro particular, reciba un cordial saludo.`,
  },
  {
    clave: "CONTROL_PRACTICAS",
    nombre: "Hoja de control de practicas",
    categoria: "ALUMNO",
    descripcion: "Registro del horario y avance de las practicas, para llenar a mano.",
    titulo: "HOJA DE CONTROL DE PRÁCTICAS",
    prefijoFolio: "HP",
    alumnoPuedeSolicitar: false,
    camposExtra: [
      { clave: "empresa", etiqueta: "Empresa o institucion", tipo: "texto", requerido: true },
      { clave: "supervisor", etiqueta: "Supervisor en la empresa", tipo: "texto", requerido: true },
      { clave: "horario", etiqueta: "Horario (ej. lunes a viernes de 9:00 a 13:00)", tipo: "texto", requerido: true },
      { clave: "fecha_inicio", etiqueta: "Fecha de inicio", tipo: "fecha", requerido: true },
      { clave: "fecha_fin", etiqueta: "Fecha de termino", tipo: "fecha", requerido: false },
      { clave: "horas", etiqueta: "Horas que debe cubrir", tipo: "numero", requerido: true },
      { clave: "renglones", etiqueta: "Renglones de la tabla", tipo: "numero", requerido: false, valorInicial: "15" },
    ],
    cuerpo: `**Alumno(a):** {{alumno.nombre_completo}}
**Matrícula:** {{alumno.matricula}}
**Grado y grupo:** {{alumno.grado}}, grupo {{alumno.grupo}}
**Empresa:** {{extra.empresa}}
**Supervisor:** {{extra.supervisor}}
**Horario:** {{extra.horario}}
**Periodo:** del {{extra.fecha_inicio}} al {{extra.fecha_fin}}
**Horas a cubrir:** {{extra.horas}}

{{tabla_control_practicas}}

[firmas]Firma y sello del supervisor`,
  },
  {
    clave: "PASE_SALIDA",
    nombre: "Pase de salida",
    categoria: "ALUMNO",
    descripcion: "Autoriza la salida del alumno del plantel durante el horario de clases.",
    titulo: "PASE DE SALIDA",
    prefijoFolio: "PS",
    alumnoPuedeSolicitar: false,
    camposExtra: [
      { clave: "fecha", etiqueta: "Fecha", tipo: "fecha", requerido: true },
      { clave: "hora_salida", etiqueta: "Hora de salida", tipo: "hora", requerido: true },
      { clave: "motivo", etiqueta: "Motivo", tipo: "texto_largo", requerido: true },
      { clave: "quien_recoge", etiqueta: "Persona que recoge al alumno", tipo: "texto", requerido: false },
      { clave: "parentesco", etiqueta: "Parentesco", tipo: "texto", requerido: false },
    ],
    cuerpo: `${FECHA}

Se autoriza la salida del plantel a **{{alumno.nombre_completo}}**, con matrícula {{alumno.matricula}}, del {{alumno.grado}}, grupo {{alumno.grupo}}, el día {{extra.fecha}} a las **{{extra.hora_salida}}** horas.

**Motivo:** {{extra.motivo}}

**Persona que lo(a) recoge:** {{extra.quien_recoge}} ({{extra.parentesco}})

[firmas]Firma de quien recoge`,
  },
  {
    clave: "PASE_ENTRADA",
    nombre: "Pase de entrada",
    categoria: "ALUMNO",
    descripcion: "Autoriza la entrada del alumno que llega despues de la hora de inicio.",
    titulo: "PASE DE ENTRADA",
    prefijoFolio: "PE",
    alumnoPuedeSolicitar: false,
    camposExtra: [
      { clave: "fecha", etiqueta: "Fecha", tipo: "fecha", requerido: true },
      { clave: "hora_llegada", etiqueta: "Hora de llegada", tipo: "hora", requerido: true },
      { clave: "motivo", etiqueta: "Motivo del retraso", tipo: "texto_largo", requerido: true },
    ],
    cuerpo: `${FECHA}

Se autoriza la entrada a clases de **{{alumno.nombre_completo}}**, con matrícula {{alumno.matricula}}, del {{alumno.grado}}, grupo {{alumno.grupo}}, quien llegó el día {{extra.fecha}} a las **{{extra.hora_llegada}}** horas.

**Motivo:** {{extra.motivo}}

Se solicita a los docentes permitir su ingreso al aula.`,
  },
  {
    clave: "JUSTIFICANTE_INASISTENCIA",
    nombre: "Justificante de inasistencia",
    categoria: "ALUMNO",
    descripcion: "Justifica las faltas del alumno en una o varias fechas.",
    titulo: "JUSTIFICANTE DE INASISTENCIA",
    prefijoFolio: "JI",
    alumnoPuedeSolicitar: false,
    camposExtra: [
      { clave: "fecha_desde", etiqueta: "Falto desde", tipo: "fecha", requerido: true },
      { clave: "fecha_hasta", etiqueta: "Hasta", tipo: "fecha", requerido: true },
      { clave: "motivo", etiqueta: "Motivo", tipo: "texto_largo", requerido: true },
    ],
    cuerpo: `${FECHA}

**A LOS DOCENTES DEL GRUPO {{alumno.grupo}}:**

Por medio del presente se justifica la inasistencia de **{{alumno.nombre_completo}}**, con matrícula {{alumno.matricula}}, del {{alumno.grado}}, grupo {{alumno.grupo}}, del {{extra.fecha_desde}} al {{extra.fecha_hasta}}.

**Motivo:** {{extra.motivo}}

Se solicita su apoyo para que el alumno(a) pueda ponerse al corriente con las actividades y evaluaciones de esas fechas.`,
  },
  {
    clave: "CITATORIO",
    nombre: "Citatorio a padres o tutores",
    categoria: "ALUMNO",
    descripcion: "Cita al padre, madre o tutor del alumno a una reunion en el plantel.",
    titulo: "CITATORIO",
    prefijoFolio: "CI",
    alumnoPuedeSolicitar: false,
    camposExtra: [
      { clave: "fecha_cita", etiqueta: "Fecha de la cita", tipo: "fecha", requerido: true },
      { clave: "hora_cita", etiqueta: "Hora de la cita", tipo: "hora", requerido: true },
      { clave: "lugar", etiqueta: "Lugar", tipo: "texto", requerido: true },
      { clave: "motivo", etiqueta: "Asunto a tratar", tipo: "texto_largo", requerido: true },
    ],
    cuerpo: `${FECHA}

**{{alumno.tutor}}**
Padre, madre o tutor de {{alumno.nombre_completo}}
P R E S E N T E

Por medio del presente se le cita el día **{{extra.fecha_cita}}** a las **{{extra.hora_cita}}** horas en {{extra.lugar}}, para tratar el siguiente asunto relacionado con su hijo(a), alumno(a) del {{alumno.grado}}, grupo {{alumno.grupo}}:

{{extra.motivo}}

Su presencia es importante. Agradecemos de antemano su puntual asistencia.

[firmas]Nombre y firma de enterado del padre, madre o tutor`,
  },
  {
    clave: "REPORTE_INCIDENCIA",
    nombre: "Reporte de incidencia",
    categoria: "ALUMNO",
    descripcion: "Deja por escrito una incidencia de conducta o disciplina.",
    titulo: "REPORTE DE INCIDENCIA",
    prefijoFolio: "RI",
    alumnoPuedeSolicitar: false,
    camposExtra: [
      { clave: "fecha_incidencia", etiqueta: "Fecha de la incidencia", tipo: "fecha", requerido: true },
      { clave: "descripcion", etiqueta: "Que sucedio", tipo: "texto_largo", requerido: true },
      { clave: "medidas", etiqueta: "Medidas tomadas", tipo: "texto_largo", requerido: false },
    ],
    cuerpo: `${FECHA}

**Alumno(a):** {{alumno.nombre_completo}}
**Matrícula:** {{alumno.matricula}}
**Grado y grupo:** {{alumno.grado}}, grupo {{alumno.grupo}}
**Fecha de la incidencia:** {{extra.fecha_incidencia}}

**Descripción de los hechos:**
{{extra.descripcion}}

**Medidas tomadas:**
{{extra.medidas}}

[firmas]Firma del alumno(a) | Firma del padre, madre o tutor`,
  },
  {
    clave: "CONSTANCIA_BAJA",
    nombre: "Constancia de baja",
    categoria: "ALUMNO",
    descripcion: "Hace constar que el alumno causo baja de la institucion.",
    titulo: "CONSTANCIA DE BAJA",
    prefijoFolio: "CB",
    alumnoPuedeSolicitar: true,
    camposExtra: [
      { clave: "fecha_baja", etiqueta: "Fecha de la baja", tipo: "fecha", requerido: true },
      { clave: "tipo_baja", etiqueta: "Tipo de baja", tipo: "opcion", requerido: true, opciones: ["temporal", "definitiva"] },
    ],
    cuerpo: `${FECHA}

**A QUIEN CORRESPONDA:**

Por medio de la presente se hace constar que **{{alumno.nombre_completo}}**, con número de matrícula {{alumno.matricula}} y CURP {{alumno.curp}}, quien cursaba el {{alumno.grado}} de {{alumno.plan}} en esta institución, causó **baja {{extra.tipo_baja}}** el día {{extra.fecha_baja}}.

${CIERRE_INTERESADO}`,
  },

  // ---------------- Personal ----------------
  {
    clave: "HOJA_DESCUENTO",
    nombre: "Hoja de descuento al personal",
    categoria: "PERSONAL",
    descripcion: "Notifica al docente o trabajador un descuento y su motivo.",
    titulo: "HOJA DE DESCUENTO",
    prefijoFolio: "HD",
    alumnoPuedeSolicitar: false,
    camposExtra: [
      { clave: "concepto", etiqueta: "Concepto del descuento", tipo: "texto", requerido: true },
      { clave: "monto", etiqueta: "Monto a descontar", tipo: "numero", requerido: true },
      { clave: "periodo", etiqueta: "Periodo de pago en que se aplica", tipo: "texto", requerido: true },
      { clave: "motivo", etiqueta: "Motivo", tipo: "texto_largo", requerido: true },
    ],
    cuerpo: `${FECHA}

**{{personal.nombre_completo}}**
{{personal.puesto}} · No. de empleado {{personal.numero_empleado}}
P R E S E N T E

Por medio del presente se le notifica que se aplicará un descuento por concepto de **{{extra.concepto}}**, por la cantidad de **{{extra.monto_moneda}}**, en el periodo de pago {{extra.periodo}}.

**Motivo:** {{extra.motivo}}

[firmas]Enterado(a): {{personal.nombre_completo}}`,
  },
  {
    clave: "CONSTANCIA_LABORAL",
    nombre: "Constancia laboral",
    categoria: "PERSONAL",
    descripcion: "Hace constar que la persona trabaja en la institucion.",
    titulo: "CONSTANCIA LABORAL",
    prefijoFolio: "CL",
    alumnoPuedeSolicitar: false,
    camposExtra: [],
    cuerpo: `${FECHA}

**A QUIEN CORRESPONDA:**

Por medio de la presente se hace constar que **{{personal.nombre_completo}}**, con RFC {{personal.rfc}}, labora en esta institución desde el {{personal.fecha_ingreso}}, desempeñando el puesto de **{{personal.puesto}}**, con un tipo de contratación {{personal.tipo_contrato}}.

${CIERRE_INTERESADO}`,
  },
  {
    clave: "OFICIO_COMISION",
    nombre: "Oficio de comision",
    categoria: "PERSONAL",
    descripcion: "Comisiona a un trabajador para una actividad fuera de su lugar habitual.",
    titulo: "OFICIO DE COMISIÓN",
    prefijoFolio: "OC",
    alumnoPuedeSolicitar: false,
    camposExtra: [
      { clave: "comision", etiqueta: "Actividad que se le encomienda", tipo: "texto_largo", requerido: true },
      { clave: "lugar", etiqueta: "Lugar", tipo: "texto", requerido: true },
      { clave: "fecha_inicio", etiqueta: "Desde", tipo: "fecha", requerido: true },
      { clave: "fecha_fin", etiqueta: "Hasta", tipo: "fecha", requerido: true },
    ],
    cuerpo: `[derecha]Oficio No. {{documento.folio}}

${FECHA}

**{{personal.nombre_completo}}**
{{personal.puesto}}
P R E S E N T E

Por medio del presente se le comisiona para: {{extra.comision}}

La comisión se llevará a cabo en {{extra.lugar}}, del {{extra.fecha_inicio}} al {{extra.fecha_fin}}.

Agradeceremos que al término de la misma entregue el informe correspondiente.`,
  },
  {
    clave: "SOLICITUD_PERMISO",
    nombre: "Solicitud de permiso del personal",
    categoria: "PERSONAL",
    descripcion: "El trabajador solicita permiso para ausentarse.",
    titulo: "SOLICITUD DE PERMISO",
    prefijoFolio: "SP",
    alumnoPuedeSolicitar: false,
    camposExtra: [
      { clave: "fecha_desde", etiqueta: "Desde", tipo: "fecha", requerido: true },
      { clave: "fecha_hasta", etiqueta: "Hasta", tipo: "fecha", requerido: true },
      { clave: "goce", etiqueta: "Tipo de permiso", tipo: "opcion", requerido: true, opciones: ["con goce de sueldo", "sin goce de sueldo"] },
      { clave: "motivo", etiqueta: "Motivo", tipo: "texto_largo", requerido: true },
    ],
    cuerpo: `${FECHA}

**{{firmante.nombre}}**
{{firmante.cargo}}
P R E S E N T E

Quien suscribe, **{{personal.nombre_completo}}**, con número de empleado {{personal.numero_empleado}} y puesto de {{personal.puesto}}, solicito de la manera más atenta se me conceda permiso **{{extra.goce}}** para ausentarme de mis labores del {{extra.fecha_desde}} al {{extra.fecha_hasta}}.

**Motivo:** {{extra.motivo}}

[firmas]Solicitante: {{personal.nombre_completo}}

[centro]Autorizado ( )     No autorizado ( )`,
  },

  // ---------------- General ----------------
  {
    clave: "OFICIO_MEMBRETADO",
    nombre: "Oficio membretado",
    categoria: "GENERAL",
    descripcion: "Oficio libre con el membrete del colegio, para cualquier destinatario.",
    titulo: "",
    prefijoFolio: "OF",
    alumnoPuedeSolicitar: false,
    camposExtra: [
      { clave: "destinatario_nombre", etiqueta: "Nombre del destinatario", tipo: "texto", requerido: true },
      { clave: "destinatario_cargo", etiqueta: "Cargo del destinatario", tipo: "texto", requerido: true },
      { clave: "destinatario_institucion", etiqueta: "Institucion del destinatario", tipo: "texto", requerido: false },
      { clave: "asunto", etiqueta: "Asunto", tipo: "texto", requerido: true },
      { clave: "contenido", etiqueta: "Contenido del oficio", tipo: "texto_largo", requerido: true },
    ],
    cuerpo: `[derecha]Oficio No. {{documento.folio}}
**Asunto:** {{extra.asunto}}

${FECHA}

**{{extra.destinatario_nombre}}**
{{extra.destinatario_cargo}}
{{extra.destinatario_institucion}}
P R E S E N T E

{{extra.contenido}}

Sin otro particular, reciba un cordial saludo.`,
  },
  {
    clave: "CIRCULAR_PADRES",
    nombre: "Circular para padres de familia",
    categoria: "GENERAL",
    descripcion: "Aviso general para padres, madres y tutores.",
    titulo: "CIRCULAR",
    prefijoFolio: "CP",
    alumnoPuedeSolicitar: false,
    camposExtra: [
      { clave: "dirigido_a", etiqueta: "Dirigida a", tipo: "texto", requerido: true, valorInicial: "Padres, madres de familia y tutores" },
      { clave: "asunto", etiqueta: "Asunto", tipo: "texto", requerido: true },
      { clave: "contenido", etiqueta: "Contenido", tipo: "texto_largo", requerido: true },
    ],
    cuerpo: `[derecha]Circular No. {{documento.folio}}

${FECHA}

**{{extra.dirigido_a}}**
P R E S E N T E

**Asunto:** {{extra.asunto}}

{{extra.contenido}}

Agradecemos de antemano su atención.`,
  },
];
