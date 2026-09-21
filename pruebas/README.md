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

## asistente.mjs

30 comprobaciones del asistente de instalacion. Requiere una base **migrada
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
