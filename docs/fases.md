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

## Fase 3 — Academico (completa)

- Cuadro de horarios por grupo, con bloques tomados de los modulos que el
  colegio definio o con horas capturadas a mano. Al guardar se revisa que el
  docente, el aula y el grupo no queden en dos lugares a la vez, y que el dia
  sea habil; cada validacion se puede apagar desde Configuracion.
- Portal del docente: sus clases del ciclo, su horario y las preferencias de
  cada clase.
- Pase de lista por clase o por dia completo, a eleccion de cada docente, con
  cinco estados (presente, ausente, retardo, justificada, salida anticipada) y
  nota por alumno. Al alcanzarse el numero de faltas consecutivas configurado
  se levanta una alerta y se notifica a los administrativos dentro del sistema.
- Bandeja de alertas de inasistencia para direccion, con seguimiento.
- Rubros de evaluacion por clase y periodo, definidos por el docente, con
  validacion de que los pesos no pasen de 100%.
- Actividades con puntos maximos y captura por alumno.
- Calificacion sugerida a partir de los rubros capturados, que el docente copia
  o ignora: la oficial siempre la confirma el.
- Cierre de periodo por clase (exige tener todas las calificaciones), reapertura
  por direccion, y apertura o cierre de la captura de cada periodo para todo el
  colegio.
- Extraordinarios, recuperaciones y titulo de suficiencia, con el tope de
  calificacion que la escuela configuro.
- Recalculo de promedios: calificacion final por materia respetando el peso de
  cada periodo, promedio del ciclo, materias aprobadas y reprobadas, creditos,
  posicion en el ranking y cuadro de honor.
- Boleta lista para imprimir o guardar como PDF desde el navegador, con el
  logo, los datos y los colores del colegio, las calificaciones por periodo, la
  final, el promedio, el lugar en el ranking y el resumen de asistencia.

Reglas de integridad que quedaron cubiertas:

- Un bloque de horario no se guarda si choca con otro del mismo docente, aula o
  grupo, ni en un dia que no sea habil.
- No se captura en un periodo cuya captura esta cerrada.
- No se cierra un periodo al que le faltan calificaciones.
- Una calificacion cerrada no se edita; solo direccion puede reabrirla.
- Los puntos de una actividad no pueden pasar de su maximo, y la calificacion
  del periodo no puede salirse de la escala: se valida en el servidor, no solo
  en el navegador.
- Un docente solo entra a sus propias clases.

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
