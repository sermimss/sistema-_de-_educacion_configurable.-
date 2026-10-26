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

42 comprobaciones de la plataforma multicolegio sobre una base **recien
migrada y vacia**, con el servidor en modo plataforma. Recorre la pregunta de
entrada, la cuenta del dueno con su clave de arranque, los codigos de alta, el
alta de dos colegios con el asistente, el bloqueo hasta marcar el pago, la
separacion de datos entre colegios (mismo usuario en los dos, materias, logo
y colores que no se ven de uno a otro, sesion que solo abre su propio
colegio) y la suspension.

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
