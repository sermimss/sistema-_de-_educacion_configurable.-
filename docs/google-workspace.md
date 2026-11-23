# Grabaciones con bloqueo completo: conectar Google Workspace

Este documento explica como funcionan hoy las grabaciones, sus limites, y
que haria falta para que el sistema **quite el acceso en el propio Google
Drive** al cumplirse el mes, sin depender de que el docente lo haga. Esta
segunda forma **aun no esta programada**: aqui se describe para decidir.

## Como funciona hoy (enlace pegado por el docente)

1. El docente graba en Meet; Google guarda el video en su Drive.
2. Pega el enlace en *Grabaciones*. Los alumnos de la clase lo ven hasta el
   mismo dia del mes siguiente; despues el sistema no los deja pasar.

Limites de esta forma:

| Limite | Por que |
|---|---|
| El bloqueo es solo dentro del sistema | El video vive en el Drive del docente. Quien copio la direccion del video en Drive puede seguir abriendolo alla mientras el docente no le quite el permiso o borre el archivo. |
| El docente debe compartir el video en Drive | Si no lo comparte con los alumnos (o con el dominio del colegio), el alumno llega a Drive y ve "Necesitas permiso". El sistema no puede revisarlo. |
| El docente pega el enlace a mano | El sistema no detecta solo que termino la clase ni que ya existe la grabacion. |
| No se puede impedir la descarga desde aqui | Eso se decide en Drive, archivo por archivo. |
| Nadie puede impedir que se grabe la pantalla | Ni con esta forma ni con la conexion a Google. |

Costo: ninguno adicional. Funciona con cualquier cuenta de Google.

## Como seria con la conexion a Google Workspace

El sistema se conecta a la cuenta de Google Workspace **del colegio** y actua
sobre los archivos de Drive de sus docentes:

1. **Encuentra la grabacion.** Con la API de Google Meet, a partir del
   enlace de Meet de la clase, obtiene las reuniones y sus grabaciones; cada
   grabacion trae el identificador de su archivo MP4 en Drive.
2. **La comparte solo con los alumnos de la clase.** Con la API de Google
   Drive le da permiso de lectura a la cuenta de Google de cada alumno
   inscrito, y puede desactivar la descarga para quien solo puede ver.
3. **Al mes, quita esos permisos en Drive.** Ya no se abre ni desde el
   sistema ni con la direccion directa de Drive. El archivo no se borra: el
   docente y la administracion lo conservan.
4. **Mantiene la lista al dia.** Si un alumno se da de baja de la clase, se le
   quita el permiso; si se inscribe uno nuevo dentro del mes, se le da.

### Que necesita el colegio

| Requisito | Detalle |
|---|---|
| Google Workspace del colegio | Los docentes deben usar cuentas del dominio del colegio (por ejemplo `@micolegio.edu.mx`), no Gmail personales. |
| Una edicion que permita grabar en Meet | Segun la ayuda de Google, grabar reuniones esta en **Education Plus** o con el complemento **Teaching and Learning**; en *Education Fundamentals* y *Education Standard* no se puede grabar. Conviene confirmarlo en la consola de administracion del colegio. |
| Cuenta de Google de cada alumno | Para darle permiso en Drive, el sistema necesita el correo de Google de cada alumno (lo ideal: cuentas del dominio del colegio). Habria que agregar ese dato al expediente. |
| Un administrador de Workspace | Para autorizar la conexion una sola vez (pasos abajo). |

### Como se conecta (lo hace el administrador de Workspace del colegio, una vez)

Forma recomendada: **conexion propia de cada colegio**.

1. En Google Cloud, con la cuenta del colegio, crear un proyecto.
2. Activar la **Google Drive API** y la **Google Meet REST API**.
3. Crear una **cuenta de servicio** y descargar su llave (archivo JSON).
4. En la consola de administracion de Workspace (*Seguridad > Acceso y
   control de datos > Controles de API > Delegacion de todo el dominio*),
   autorizar esa cuenta de servicio con los permisos de Drive y de lectura de
   Meet.
5. En el sistema, en *Configuracion > Google Workspace*, subir la llave y
   escribir el dominio del colegio. El sistema hace una prueba y dice si
   quedo bien conectado.

La llave se guardaria cifrada en la base y nunca se mostraria de nuevo.

Por que esta forma: el proyecto de Google pertenece al propio colegio y solo
lo usan sus cuentas. Google indica que una app **interna** de una
organizacion no necesita pasar por su verificacion de apps.

La alternativa seria una sola app de la plataforma para todos los colegios
(boton "Conectar con Google"). Es mas comoda para el colegio, pero pide
acceso a Drive de cuentas de otras organizaciones. Para eso Google exige
**verificacion de permisos restringidos** y una **evaluacion de seguridad
anual (CASA)** por un evaluador externo. Esa evaluacion cobra entre 500 y
4,500 USD segun la complejidad, tarda semanas y se repite cada 12 meses.

### Limites que siguen existiendo con la conexion

- Mientras la grabacion esta vigente, quien la ve puede grabar la pantalla.
  Desactivar la descarga lo dificulta, pero no lo impide.
- Si el docente le comparte el video a alguien por su cuenta en Drive, ese
  permiso no lo puso el sistema y no lo quita. Se puede revisar y avisar.
- Si un docente deja el colegio y su cuenta se elimina, sus archivos se
  transfieren segun la politica de Workspace del colegio.
- Si Google cambia sus APIs o el administrador revoca la autorizacion, la
  conexion deja de funcionar hasta reautorizarla. El sistema lo avisaria en
  el panel de la administracion.
- Las instalaciones locales necesitan salida a internet hacia Google.

### Que tiene que pasar exactamente al cumplirse el mes

Quitar permisos a tiempo requiere que algo corra **todos los dias**, aunque
nadie entre al sistema. En el servicio gratuito de Render el servidor se
duerme tras 15 minutos sin visitas; dormido, no corre nada. Opciones:

| Opcion | Costo | Efecto |
|---|---|---|
| Revisar al despertar | Ninguno | Los permisos vencidos se quitan cuando alguien entra al sistema. Puede haber horas o dias de retraso si nadie entra. |
| Tarea programada de Render (*Cron Job*) | De pago: Render cobra solo el tiempo que corre, pero no esta en el plan gratuito | Corre a diario a la hora fijada, aunque el servidor duerma. |
| Servidor de pago en Render | Plan de pago mensual de Render | El servidor no se duerme y la revision corre a diario. |
| Instalacion local | Ninguno extra | Corre mientras la computadora del colegio este prendida. |

## Resumen de costos

| Concepto | Hoy (enlace) | Con conexion a Workspace |
|---|---|---|
| Licencias de Google | Lo que el colegio ya pague | El colegio necesita una edicion que permita grabar (Education Plus o el complemento Teaching and Learning, segun Google) |
| APIs de Google (Drive, Meet) | — | Sin costo dentro de los limites de uso normales |
| Verificacion de Google | — | Ninguna con la conexion propia de cada colegio; 500 a 4,500 USD al ano si fuera una sola app de la plataforma |
| Hospedaje | Igual que hoy | Igual que hoy si basta con revisar al despertar; de pago si se quiere puntualidad diaria en Render |
| Desarrollo | — | Trabajo de programacion: conexion, configuracion, correo de Google por alumno, permisos, revision diaria y pruebas |

Fuentes: ayuda de Google Meet sobre grabar reuniones
(support.google.com/meet/answer/9308681); referencia de la API de Meet,
`conferenceRecords.recordings` (developers.google.com/workspace/meet/api);
verificacion de permisos restringidos y evaluacion de seguridad de Google
(developers.google.com/identity/protocols/oauth2/production-readiness y
support.google.com/cloud/answer/13465431); planes gratuitos de Render
(render.com/docs/free y render.com/pricing).
