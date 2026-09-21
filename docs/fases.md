# Plan de entrega por fases

## Fase 1 — Nucleo configurable (completa)

- Modelo de datos completo de las cinco fases.
- Asistente de instalacion en 10 pasos: institucion, planteles y turnos,
  niveles y planes, ciclo y periodos, escala de evaluacion, horarios,
  asistencia, finanzas, cuenta de administrador y confirmacion.
- Motor de configuracion con 59 parametros editables.
- Acceso, roles (administrador, docente, alumno) y permisos por pantalla.
- Bitacora de auditoria.
- Consulta de la estructura academica creada.
- Empaquetado con Docker y suites de prueba de extremo a extremo.

## Fase 2 — Control escolar (completa)

- Alta, edicion, busqueda y expediente de alumnos, con matricula generada
  segun la plantilla configurada, tutores y datos medicos opcionales.
- Alta de personal y docentes, con los datos de nomina que usara la Fase 5.
- Catalogo de materias y areas; mapa curricular por plan y grado con creditos,
  horas y prerrequisitos encadenados.
- Grupos con cupo, apertura de clases (materia + docente) e inscripcion de
  alumnos, que valida plan, cupo y prerrequisitos aprobados.
- Importador CSV de alumnos, personal y materias, con plantilla descargable e
  informe de errores por fila.
- Cuentas de acceso con contrasena temporal y cambio obligatorio en el primer
  ingreso.

Reglas de integridad que quedaron cubiertas:

- No se puede retirar una materia del plan si tiene clases abiertas o es
  prerrequisito de otra.
- No se puede eliminar una clase que ya tiene calificaciones, actividades o
  asistencia.
- No se puede quitar el perfil docente a quien tiene clases asignadas.
- No se puede bajar el cupo de un grupo por debajo de los alumnos inscritos.
- Un alumno no puede estar inscrito en dos grupos del mismo ciclo.

## Fase 3 — Academico

- Constructor de horarios con deteccion de choques de docente, aula y grupo.
- Pase de lista por dia o por clase, a eleccion del docente, con la alerta de
  faltas consecutivas hacia los administrativos.
- Rubros de evaluacion por clase, captura de actividades y calificaciones.
- Cierre de periodo, calificacion final, extraordinarios.
- Boleta en PDF con el logo y los datos de la institucion.
- Promedios, ranking y cuadro de honor.

## Fase 4 — Finanzas y portales

- Generacion automatica de cargos a partir de los conceptos, el plan de
  estudios y el dia de vencimiento configurados.
- Aplicacion de becas y descuentos, acumulables o no segun la configuracion.
- Recargos por mora con periodo de gracia.
- Caja: pagos totales y parciales, un pago que cubre varios cargos.
- Convenios de pago en parcialidades.
- Recibo interno en PDF, con la estructura CFDI 4.0 lista para timbrar.
- Pasarela de pago en linea configurable por la escuela.
- Estado de cuenta y bandera de adeudo, con bloqueo opcional de servicios.
- Portal del alumno: calificaciones, asistencia, horario, estado de cuenta.
- Portal del docente: sus grupos, captura de asistencia y calificaciones.

## Fase 5 — Nomina

- Conceptos de percepcion y deduccion configurables.
- Periodos de nomina, calculo, autorizacion y pago.
- Recibo de nomina por empleado e historial.
