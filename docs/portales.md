# Portales de docentes y alumnos

Todos entran por la **misma direccion** y la **misma pantalla de acceso** que
la administracion. El sistema reconoce el rol de la cuenta y muestra solo el
menu y las pantallas de ese rol. No hay una direccion aparte por portal.

- **Instalacion local**: la direccion del servidor del colegio (por ejemplo
  `http://192.168.1.10:3000`), luego "Entrar".
- **Plataforma en internet**: la direccion del colegio
  (`https://<plataforma>/<direccion-del-colegio>`). La primera vez el
  navegador recuerda el colegio y despues va directo al acceso.

## Como obtienen su cuenta

| Rol | Quien la crea | Usuario | Contrasena inicial |
|---|---|---|---|
| Docente | La administracion, en *Personal y docentes*, al dar de alta a un empleado con puesto docente y marcar "crear usuario" | Su numero de empleado (en minusculas) o su correo | Su numero de empleado |
| Alumno | La administracion, en *Alumnos* (alta o importacion CSV) con "crear usuario" | Su matricula o su correo | Su matricula |

En el primer acceso el sistema **obliga a cambiar la contrasena** y no deja
usar ninguna pantalla hasta hacerlo. Si la olvidan, usan "¿Olvidaste tu
contrasena?" en el acceso y la administracion les da una temporal desde
*Solicitudes de acceso*.

## Portal del docente

Menu: Panel, Avisos, Asistencia, Calificaciones, Mis clases, Mi horario.

| Puede | Detalle |
|---|---|
| Ver sus clases de hoy | El panel muestra sus clases del dia; la que esta por empezar (10 minutos antes) o en curso aparece marcada **en curso** con su boton de Meet. |
| Ver su horario semanal | *Mi horario*: cuadricula de la semana con sus clases, salon y grupo. |
| Poner la sala de Google Meet | *Mis clases*: pega el enlace de Meet en cada clase, o una sola sala para **todas** sus clases. Solo acepta enlaces de `meet.google.com` (o el codigo `abc-defg-hij`); se borra dejando el campo vacio. |
| Pasar lista | *Asistencia*, solo de sus clases. |
| Capturar calificaciones | *Calificaciones*: actividades, puntos y la calificacion oficial de cada periodo; puede cerrar el periodo cuando todos tienen calificacion. |
| Publicar avisos | *Avisos*, solo a los alumnos de **sus clases**. Puede retirar los que el publico. |
| Ver quien tiene adeudo | Solo si el colegio lo activa (ver abajo). Ve una marca "adeudo" junto al alumno, **nunca montos**. |

No puede: ver clases, alumnos ni calificaciones de otros docentes; dar de
alta alumnos o personal; tocar finanzas, nomina, configuracion, estructura
academica, horarios generales ni la bitacora; publicar avisos a todo el
colegio o a un grupo completo (el servidor lo rechaza aunque se altere la
pagina); reabrir un periodo cerrado.

## Portal del alumno

Menu: Panel, Avisos, Mis calificaciones, Mi asistencia, Mi horario, Estado de
cuenta, Mis documentos.

| Puede | Detalle |
|---|---|
| Ver sus clases de hoy | En el panel, con el boton **Entrar a la clase en linea** cuando el docente puso su Meet; la clase en curso aparece resaltada. |
| Ver su horario semanal | *Mi horario*, con el boton de Meet en cada clase que lo tenga. |
| Ver sus calificaciones y su asistencia | De su grupo vigente. |
| Ver su estado de cuenta | Sus cargos y sus pagos. No paga en linea: paga en el colegio. |
| Pedir documentos | *Mis documentos*: pide constancias y otros documentos que el colegio habilite, y ve los emitidos a su nombre. |
| Leer avisos | Los del colegio, los de su grupo y los de sus clases; los mas recientes aparecen tambien en su panel. |

No puede: ver datos de otros alumnos, modificar nada academico ni financiero,
ni entrar a ninguna pantalla de la administracion o del docente.

Si el colegio activo el **bloqueo por adeudo** en Finanzas, al alumno con
atraso se le ocultan las calificaciones y la boleta hasta que pague.

## Lo que el colegio enciende o apaga

En *Configuracion → Portales*:

| Opcion | Por omision | Efecto |
|---|---|---|
| Portal del alumno: calificaciones | Si | Muestra u oculta *Mis calificaciones*. |
| Portal del alumno: asistencia | Si | Muestra u oculta *Mi asistencia*. |
| Portal del alumno: horario | Si | *Mi horario* y las clases de hoy (con Meet) en su panel. |
| Portal del alumno: estado de cuenta | Si | *Estado de cuenta*. |
| Portal del alumno: avisos | Si | *Avisos* y los avisos recientes en su panel. |
| El docente puede ver adeudos de sus alumnos | No | Marca "adeudo" en las listas de asistencia y calificaciones del docente, sin montos. |
| El docente puede editar su horario | No | **Aun no tiene efecto**: el horario lo arma la administracion en *Horarios*. |

## Google Meet

El sistema no crea las reuniones ni se conecta a la cuenta de Google del
colegio: el docente crea su sala en Meet (con su cuenta institucional) y
pega el enlace una vez. Desde ese momento el alumno ve el boton en su panel y
en su horario, y la clase en curso se resalta segun el horario del grupo y la
zona horaria del colegio. El boton abre Meet en otra pestana sin enviar datos
del sistema.

## Cambio de modalidad del plan

En *Estructura academica → Cambiar modalidad* (solo administracion):

- **Plan sin grupos ni alumnos**: se convierte tal cual (por ejemplo, de 6
  semestres a 9 cuatrimestres). Las materias se reparten en los periodos
  nuevos de forma proporcional.
- **Plan en uso**: se crea un plan nuevo en la otra modalidad, con sus
  materias y prerrequisitos copiados si se pide. Los alumnos actuales
  terminan en su plan; el anterior deja de aparecer al dar de alta alumnos
  nuevos.

En los dos casos conviene revisar despues el mapa curricular: el reparto es
proporcional, no una equivalencia oficial.
