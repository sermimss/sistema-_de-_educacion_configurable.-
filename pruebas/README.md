# Pruebas de extremo a extremo

Usan Playwright contra un navegador real. No hay simulaciones: se levanta el
sistema, se navega, se llenan formularios y se verifica lo que queda en la base.

## Requisitos

```bash
npm install
npx playwright install chromium   # si el navegador no esta instalado
```

Las suites apuntan a `http://localhost:3000`.

## humo.mjs

27 comprobaciones sobre una base **ya instalada**. Verifica acceso, rechazo de
credenciales invalidas, panel de cada rol, permisos por rol, edicion de
configuracion con persistencia, y registro en la bitacora. Es repetible: puede
correrse cuantas veces se quiera sobre la misma base.

```bash
SEED_DEMO=1 npm run db:seed
npm run build && npm start
npm run prueba:humo
```

## control-escolar.mjs

28 comprobaciones de la Fase 2 sobre una base **ya instalada**. Crea materias,
las coloca en el mapa curricular, valida el orden de los prerrequisitos, da de
alta personal y alumnos, arma un grupo con clase y docente, inscribe alumnos
hasta topar el cupo, importa un CSV con una fila invalida a proposito y recorre
el cambio obligatorio de contrasena. Es repetible: cada corrida usa un sufijo
distinto para las claves.

```bash
npm run prueba:control
```

## recuperacion-acceso.mjs

20 comprobaciones sobre una base **recien sembrada con los datos de
demostracion**, con `DATABASE_URL` apuntando a esa base. Un docente pide una
contrasena nueva desde el acceso (sin revelar que cuentas existen ni duplicar
solicitudes), la administracion le asigna una temporal, el docente entra,
no puede saltarse el cambio con el menu y la cambia; una solicitud se
descarta sin tocar la contrasena; y el comando local `restablecer-admin`
devuelve el acceso al administrador y cierra sus sesiones abiertas.

```bash
DATABASE_URL=... npm run prueba:recuperacion
```

## portales.mjs

40 comprobaciones sobre una base **recien sembrada con los datos de
demostracion**, con `DATABASE_URL` apuntando a esa base. Pone un horario de
hoy alrededor de la hora actual y recorre: el docente pega su sala de Google
Meet (rechaza enlaces que no son de Meet, completa el codigo, la pone en todas
sus clases), ve su horario y su clase en curso; el alumno ve el boton para
entrar en su panel y en su horario. Avisos del colegio, de un grupo y de una
clase (el docente solo a sus clases, ni alterando el formulario), retirar un
aviso y apagar la seccion. La marca de adeudo en las listas del docente
cuando el colegio la activa. Que cada portal no entre a pantallas ajenas. Y el
cambio de modalidad: version cuatrimestral de un plan en uso (materias y
prerrequisitos copiados, el anterior sin nuevo ingreso) y conversion directa
de un plan sin alumnos.

```bash
DATABASE_URL=... npm run prueba:portales
```

## grabaciones.mjs

35 comprobaciones sobre una base **recien sembrada con los datos de
demostracion**, con `DATABASE_URL` apuntando a esa base. Revisa la regla del
mes (3 de marzo a 3 de abril, fin de mes, cambio de ano) y la limpieza de
enlaces de Drive; el docente publica desde *Mis clases* (rechaza enlaces que
no son de Drive, fechas futuras y clases de hace mas de un mes); el alumno ve
solo las vigentes, abre la que vence hoy y no puede abrir una vencida ni con
la direccion; un alumno dado de baja y alguien sin sesion no entran; el
docente ve las vencidas y quien abrio cada una; la administracion las
consulta todas.

```bash
DATABASE_URL=... npm run prueba:grabaciones
```

## cambios-horario.mjs

40 comprobaciones sobre una base **recien sembrada con los datos de
demostracion**, con `DATABASE_URL` apuntando a esa base. Con la opcion
apagada el docente no puede pedir cambios; encendida, pide cambios
permanentes y reposiciones de una fecha (rechaza los que chocan, los de
fechas pasadas, la fecha que no cae en el dia del bloque y las solicitudes
repetidas) y cancela una. La administracion aprueba tal cual con aviso a los
alumnos, ve que una solicitud ya choca, ajusta la hora y aprueba, y rechaza
con motivo. El docente ve las respuestas, el alumno el aviso y su horario de
la semana con la clase movida tachada y la reposicion en su lugar. Revisa
que una reposicion no caiga sobre otra y que el lugar que deja una clase
movida quede libre.

```bash
DATABASE_URL=... npm run prueba:cambios-horario
```

## carreras.mjs

31 comprobaciones sobre una base **recien sembrada con los datos de
demostracion**, con `DATABASE_URL` apuntando a esa base. Desde Estructura
academica crea un nivel (sin repetir nombre), una certificacion modular de 3
modulos y una carrera de 6 semestres (rechaza claves repetidas o invalidas y
nombres de periodo sin {N}); revisa que aparezcan al dar de alta alumnos y
al abrir grupos; edita nombre y titulo (con antes y despues en la
bitacora), cambia de nivel solo sin alumnos ni grupos; da de baja una
carrera con alumnos (deja de aparecer para nuevo ingreso sin borrar nada) y
la reactiva; y confirma el campo del titulo en los machotes.

```bash
DATABASE_URL=... npm run prueba:carreras
```

## eliminar-academico.mjs

27 comprobaciones sobre una base **recien sembrada con los datos de
demostracion**, con `DATABASE_URL` apuntando a esa base. Eliminar no se ve
hasta abrir el menu ⋯ y Cancelar cierra la ventana sin borrar. Un grupo con alumnos
o con una tarea no se elimina y dice por que; sin escribir el nombre no se
elimina; un grupo vacio se borra con sus clases, horarios, inscripciones de
baja y su calendario, y desactiva su aviso. Un nivel con un grupo pide
eliminarlo primero (con enlace); un nivel vacio se borra con su
certificacion y desactiva su concepto de cobro; un nivel con alumnos no se
borra, se da de baja (cierra el nuevo ingreso sin borrar nada) y se vuelve a
ofrecer.

```bash
DATABASE_URL=... npm run prueba:eliminar-academico
```

## tareas.mjs

37 comprobaciones sobre una base **recien sembrada con los datos de
demostracion**, con `DATABASE_URL` apuntando a esa base. El docente pide una
tarea (no con fecha pasada); el alumno la ve pendiente, entrega 3 archivos y
texto (rechaza entregas vacias, archivos disfrazados, programas, mas de 10 MB
y mas de 3 archivos), descarga lo suyo (un companero y alguien sin sesion
no) y vuelve a entregar reemplazando todo. El docente ve quien entrego,
descarga, califica con comentario (sin pasar del maximo) y el alumno ya no
puede cambiarla. Entregas tardias segun la tarea, editar, eliminar sin
entregas y alcance por clase y por rol.

```bash
DATABASE_URL=... npm run prueba:tareas
```

## examenes.mjs

40 comprobaciones sobre una base **recien sembrada con los datos de
demostracion**, con `DATABASE_URL` apuntando a esa base. El docente crea un
examen, no lo puede publicar vacio, agrega los cuatro tipos de pregunta (con
sus validaciones, conservando lo escrito si hay error) y lo publica. El
alumno lo contesta con reloj y autoguardado (sigue al recargar), la pagina no
revela las correctas, se califican solas las cerradas (varias correctas: todo
o nada) y ve sus respuestas al terminar; no puede repetirlo. El docente
revisa y califica la abierta. Envio automatico al acabarse el tiempo y al
abandonar el examen, desorden por alumno, cierre, tardios, mostrar
respuestas al cerrar y alcance.

```bash
DATABASE_URL=... npm run prueba:examenes
```

## importar-examen.mjs

18 comprobaciones sobre una base **recien sembrada con los datos de
demostracion**, con `DATABASE_URL` apuntando a esa base. Carga un texto con
errores (los senala por renglon y no agrega nada), el ejemplo con los cinco
casos (opcion multiple, varias correctas, verdadero/falso, respuesta por
letra y abierta), un `.docx` generado con la numeracion automatica de Word y
un `.txt` en ANSI con acentos; rechaza otros archivos; y el examen cargado se
publica y se contesta como cualquier otro.

```bash
DATABASE_URL=... npm run prueba:importar-examen
```

## pagos-fiables.mjs

34 comprobaciones sobre una base **recien sembrada con los datos de
demostracion**, con `DATABASE_URL` apuntando a esa base. Recargos calculados
solos al abrir el estado de cuenta y quitados si el pago llego a tiempo
(fecha anterior); referencia obligatoria segun el metodo; saldo a favor que
cubre solo un cargo nuevo sin cambiar el recibo; cambio en efectivo; fechas
futuras rechazadas y pasadas aceptadas; referencia repetida con
confirmacion; el mismo formulario enviado tres veces registra un pago; dos
cajas cobrando a la vez (no se cobra dos veces ni se repiten folios); adeudo
por fecha para el docente y la lista de Finanzas; y cancelar un pago con
saldo a favor revierte todo.

```bash
DATABASE_URL=... npm run prueba:pagos
```

## caja.mjs

25 comprobaciones sobre una base **recien sembrada con los datos de
demostracion**, con `DATABASE_URL` apuntando a esa base. Sin caja abierta no
se cobra (pantalla y servidor); abre la caja con fondo, busca alumnos, cobra
en efectivo y transferencia con el recibo listo para imprimir y regreso a la
caja; cancela dentro del turno; corte parcial; cierre con faltante; un corte
cerrado ya no permite cancelar sus pagos; cada cajero con su propio turno y
la lista de cortes con filtro por cajero. Las suites de finanzas,
integridad y pagos abren caja antes de cobrar.

```bash
DATABASE_URL=... npm run prueba:caja
```

## cobranza.mjs

49 comprobaciones sobre una base **recien sembrada con los datos de
demostracion**, con `DATABASE_URL` apuntando a esa base. Referencia de pago
con digito verificador y datos bancarios en el estado de cuenta del alumno;
el alumno sube comprobantes (rechaza archivos falsos, conserva lo capturado
si hay error, no repite referencias); alta de una cajera desde Personal con
acceso de Caja; lo que la cajera ve y no ve; confirmar pide la caja abierta,
registra el pago en su turno, salda el cargo y no duplica; rechazar pide
motivo; el alumno ve el resultado y su recibo; buscar por referencia en caja;
cobro de la cajera; solo ve sus cortes y hace su corte; cambiar el acceso
despues cierra sus sesiones; generar cargos por matricula.

```bash
DATABASE_URL=... npm run prueba:cobranza
```

## menu-movil.mjs

39 comprobaciones con el navegador en tamano de celular (390 x 844) sobre una
base con los datos de demostracion. El menu abre y cierra (boton, X, Esc,
tocar fuera), lleva a cada pantalla, marca en cual estas y trae el enlace
para cambiar la contrasena; cada rol ve sus opciones; y ninguna de 20
pantallas se sale a lo ancho. Tambien revisa que en la computadora siga el
menu lateral. No modifica nada: se puede repetir.

```bash
npm run prueba:movil
```

## documentos-marca.mjs

43 comprobaciones sobre una base **recien sembrada con los datos de
demostracion**. Sube un logo (y rechaza un archivo que finge ser imagen),
comprueba que se toman sus colores y que todo el colegio los usa (menu, icono
de la pestana, acceso, texto legible sobre colores claros), da de alta un
firmante con firma y sello, genera constancias, pases, hojas de descuento y un
machote propio con los datos reales, edita un machote, cancela un documento,
y recorre las solicitudes desde el portal del alumno (atendida y rechazada).
Tambien revisa que un alumno no vea documentos ajenos y que al imprimir solo
salga la hoja.

```bash
npm run prueba:documentos
```

## plataforma.mjs

58 comprobaciones de la plataforma multicolegio sobre una base **recien
migrada y vacia**, con el servidor en modo plataforma. Recorre la pregunta de
entrada, la cuenta del dueno con su clave de arranque, los codigos de alta, el
alta de dos colegios con el asistente, el bloqueo hasta marcar el pago, la
separacion de datos entre colegios (mismo usuario en los dos, materias, logo
y colores que no se ven de uno a otro, sesion que solo abre su propio
colegio), la suspension y la recuperacion de la cuenta del dueno con la clave
de arranque (incluido el freno tras 5 claves equivocadas) y el enlace de un
solo uso con el que el administrador de un colegio recupera su acceso.

```bash
MODO_PLATAFORMA=1 PLATAFORMA_CLAVE_ARRANQUE=clave-de-arranque-de-prueba npm start
npm run prueba:plataforma
```

## grupos-horario.mjs

33 comprobaciones sobre una base **recien sembrada con los datos de
demostracion**. Cada grupo trae su propio calendario: crea grupos con fechas
de inicio y termino de clases, parciales y tabla de horario (materia, docente,
dia y hora). Verifica el reparto de parciales, que una materia tenga un solo
docente, los choques dentro del grupo y contra otros grupos con fechas que se
cruzan (y que no choquen si las fechas no se cruzan), que con choque no se
guarde nada, la inscripcion segun fechas, la pantalla de horarios y que las
colegiaturas se calculen con las fechas del grupo de cada alumno.

```bash
npm run prueba:grupos
```

## academico.mjs

40 comprobaciones de la Fase 3. Requiere una base **recien sembrada con los
datos de demostracion**, porque cuenta rubros, pesos y periodos desde cero.

```bash
createdb escuela_fase3
DATABASE_URL="postgresql://.../escuela_fase3" npx prisma migrate deploy
DATABASE_URL="postgresql://.../escuela_fase3" SEED_DEMO=1 npm run db:seed
DATABASE_URL="postgresql://.../escuela_fase3" npm start
npm run prueba:academico
```

Cubre el cuadro de horarios y sus tres tipos de choque, el portal del docente,
el pase de lista hasta disparar la alerta por faltas consecutivas y su
seguimiento por direccion, los rubros con el tope de 100%, la captura de
actividades, la calificacion sugerida y la oficial, el cierre y reapertura de
periodo, el recalculo de promedios y el contenido de la boleta. Tambien
comprueba que el servidor rechaza un puntaje fuera de rango aunque se burle la
validacion del navegador, y que un docente no abre clases ajenas.

## finanzas.mjs

40 comprobaciones de la Fase 4. Requiere una base **recien sembrada con los
datos de demostracion**.

```bash
createdb escuela_fase4
DATABASE_URL="postgresql://.../escuela_fase4" npx prisma migrate deploy
DATABASE_URL="postgresql://.../escuela_fase4" SEED_DEMO=1 npm run db:seed
DATABASE_URL="postgresql://.../escuela_fase4" npm start
npm run prueba:finanzas
```

Cubre el alta de conceptos con motivo, monto y tiempo propios y sus
validaciones, las reglas de recargo, las becas y su asignacion, la vista previa
y la generacion de cargos (comprobando que correrla dos veces no duplica), el
estado de cuenta, un pago parcial y el pago del resto, el recibo, la
cancelacion de un pago con restauracion de saldos, un cargo manual, un convenio
en parcialidades, el recalculo de recargos (que tampoco duplica), las cuatro
pantallas del portal del alumno y el bloqueo por adeudo encendiendolo y
apagandolo desde Configuracion.

## integridad-finanzas.mjs

27 comprobaciones que revisan **lo que queda guardado en la base de datos**,
no lo que muestra la pantalla. Verifica que desactivar conceptos persiste, que
un pago parcial y el pago del resto dejan los cargos en saldo cero y estado
PAGADO con lo aplicado cuadrando al centavo, y que cancelar un pago restaura
los saldos exactos, los estados previos y la bandera de adeudo. Requiere base
recien sembrada.

```bash
npm run prueba:integridad
```

## nomina.mjs

42 comprobaciones de la Fase 5 sobre una base **recien sembrada**. Mezcla
comprobaciones de pantalla y de base de datos.

```bash
createdb escuela_fase5
DATABASE_URL="postgresql://.../escuela_fase5" npx prisma migrate deploy
DATABASE_URL="postgresql://.../escuela_fase5" SEED_DEMO=1 npm run db:seed
DATABASE_URL="postgresql://.../escuela_fase5" npm start
npm run prueba:nomina
```

Cubre el catalogo de conceptos y sus validaciones, la creacion de periodos con
rechazo de fechas invertidas y de traslapes, el calculo con la aritmetica
exacta del recibo (sueldo prorrateado, percepciones, deducciones y neto),
que recalcular no duplique ni toque lo autorizado, los ajustes manuales y su
supervivencia al recalculo, la autorizacion, el pago del periodo, la
cancelacion de un recibo con motivo, la bitacora, los permisos y el apagado
del modulo completo desde Configuracion.

## asistente.mjs

29 comprobaciones del asistente de instalacion. Requiere una base **migrada
pero sin instalar**, porque prueba precisamente la instalacion inicial.

```bash
createdb escuela_prueba
DATABASE_URL="postgresql://.../escuela_prueba" npx prisma migrate deploy
DATABASE_URL="postgresql://.../escuela_prueba" npm start
npm run prueba:asistente
```

Comprueba que los valores capturados en el asistente (escala 0 a 10, minima
aprobatoria 6, plan de 9 cuatrimestres, alerta a las 4 faltas, vencimiento el
dia 5, recargo del 12%) son exactamente los que el sistema usa despues.
Para volver a correrla hay que recrear la base, ya que el asistente solo puede
ejecutarse una vez.

## red-local.mjs

22 comprobaciones de la red local del colegio. Necesita **dos instalaciones
corriendo** con la misma clave de red, una con la base activa y otra sumada a
ella.

```bash
A_PRUEBAS=http://localhost:3401 \
B_PRUEBAS=http://localhost:3402 \
CLAVE_RED='la-clave-del-colegio' \
npm run prueba:red
```

Comprueba que las dos copias de las primitivas de firma (la del sistema en
TypeScript y la del descubridor en mjs) producen la misma firma; que los
papeles quedaron bien repartidos; que las dos computadoras alcanzan la base y
ven el mismo colegio; y, lo que de verdad importa, que **un concepto de cobro
dado de alta en una aparece en la otra**.

Del lado de la seguridad verifica que con la clave del colegio se obtienen las
credenciales de la base, que sin ella se rechaza con 403 sin filtrar nada, que
una peticion grabada y repetida se rechaza, que una vencida se rechaza, y que
una computadora que no tiene la base activa no reparte credenciales.
