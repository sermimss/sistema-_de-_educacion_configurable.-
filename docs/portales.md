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

Menu: Panel, Avisos, Asistencia, Calificaciones, Mis clases, Grabaciones, Mi horario.

| Puede | Detalle |
|---|---|
| Ver sus clases de hoy | El panel muestra sus clases del dia; la que esta por empezar (10 minutos antes) o en curso aparece marcada **en curso** con su boton de Meet. |
| Ver su horario semanal | *Mi horario*: cuadricula de la semana con sus clases, salon y grupo, incluidas las reposiciones de esa semana. |
| Pedir cambios de horario | Solo si el colegio lo activa. En *Mi horario* elige uno de sus bloques y pide moverlo **de ahi en adelante** o **solo en una fecha** (reposicion), con el motivo. No puede enviar un cambio que choque con otra clase suya, del grupo o del salon. Su horario no cambia hasta que la administracion lo aprueba; ve si se aprobo, se ajusto o se rechazo (con el motivo) y puede cancelar las pendientes. |
| Poner la sala de Google Meet | *Mis clases*: pega el enlace de Meet en cada clase, o una sola sala para **todas** sus clases. Solo acepta enlaces de `meet.google.com` (o el codigo `abc-defg-hij`); se borra dejando el campo vacio. |
| Compartir grabaciones | *Grabaciones* (o el boton en cada clase de *Mis clases*): pega el enlace de Drive de la grabacion de Meet, la fecha de la clase y un titulo opcional. Ve todas las suyas, tambien las vencidas, y que alumnos abrieron cada una y cuantas veces. |
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

Menu: Panel, Avisos, Grabaciones, Mis calificaciones, Mi asistencia, Mi horario,
Estado de cuenta, Mis documentos.

| Puede | Detalle |
|---|---|
| Ver sus clases de hoy | En el panel, con el boton **Entrar a la clase en linea** cuando el docente puso su Meet; la clase en curso aparece resaltada. |
| Ver su horario semanal | *Mi horario*, con el boton de Meet en cada clase que lo tenga. |
| Ver las grabaciones de sus clases | *Grabaciones*: solo las que aun no cumplen su mes, con la fecha en que dejan de verse. |
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
| El docente puede editar su horario | No | El docente puede **pedir** cambios de su horario; la administracion los aprueba en *Cambios de horario*. Apagada, el docente no puede enviar solicitudes, pero conserva su historial. |

## Cambios de horario con aprobacion

1. El docente pide el cambio en *Mi horario* (con la opcion activada).
2. La administracion ve un aviso en su panel y la solicitud en *Cambios de
   horario*: horario actual, lo pedido, el motivo y si algo cambio desde
   entonces y ahora choca.
3. Puede **aprobar** tal cual o **ajustando** dia, fecha, horas o salon, con
   una nota para el docente y, si lo marca, **un aviso para los alumnos** de
   la clase; o **rechazar** escribiendo el motivo. Al aprobar se vuelven a
   revisar los choques.
4. Un cambio permanente modifica el bloque. Una reposicion solo cambia esa
   fecha: esa semana el bloque aparece tachado con a donde se movio, y la
   clase aparece en su nueva fecha y hora; las demas semanas siguen igual.
   El lugar que deja libre una clase movida queda disponible ese dia.

Pendiente: la pantalla *Horarios* de la administracion muestra el horario
semanal fijo, sin las reposiciones de una fecha.

## Google Meet

El sistema no crea las reuniones ni se conecta a la cuenta de Google del
colegio: el docente crea su sala en Meet (con su cuenta institucional) y
pega el enlace una vez. Desde ese momento el alumno ve el boton en su panel y
en su horario, y la clase en curso se resalta segun el horario del grupo y la
zona horaria del colegio. El boton abre Meet en otra pestana sin enviar datos
del sistema.

## Grabaciones de las clases

1. El docente graba su clase en Meet. Google guarda el video en su Google
   Drive (carpeta *Meet Recordings*).
2. Al terminar, el docente abre el video en Drive, usa *Compartir* y pega ese
   enlace en *Grabaciones*, con la fecha de la clase. Solo se aceptan enlaces
   de archivos de Google Drive.
3. Los alumnos que cursan la clase la ven en *Grabaciones* **hasta el mismo
   dia del mes siguiente** a la clase: la del 3 de marzo, hasta el 3 de abril
   inclusive. Si ese mes no tiene ese dia (31 de enero), hasta el ultimo dia
   del mes (28 o 29 de febrero). Se cuenta con la zona horaria del colegio.
4. Al dia siguiente la grabacion desaparece de la lista del alumno y el
   sistema ya no lo deja entrar, aunque guarde la direccion. Las que aun no
   cumplen su mes se siguen viendo.
5. El docente y la administracion la siguen viendo, marcada **Vencida**, y ven
   que alumnos la abrieron, cuantas veces y cuando.

No se puede publicar la grabacion de una clase futura ni de una clase de hace
mas de un mes (los alumnos ya no la podrian ver). Un alumno dado de baja de la
clase deja de ver sus grabaciones.

**Permisos en Drive.** El video sigue siendo un archivo del Drive del
docente, asi que el alumno necesita permiso para verlo alla: lo mas sencillo
es compartirlo con los alumnos (o con el dominio del colegio, si usan Google
Workspace). El sistema controla quien llega al video desde aqui y hasta
cuando, pero no puede quitar permisos en Drive: un alumno que copio la
direccion del video en Drive podria seguir abriendolo alla mientras el
docente no le quite el permiso o borre el archivo. Para que el bloqueo sea
total, el docente debe dejar de compartir o borrar el video en Drive al
vencer.

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

Para que el bloqueo de las grabaciones sea completo (que el sistema quite el
permiso en Drive), ver `docs/google-workspace.md`.
