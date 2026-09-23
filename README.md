# Sistema de Gestion Escolar y Financiera Configurable

Sistema de control escolar y finanzas pensado para que **cualquier institucion**
lo instale y lo configure a su realidad, sin tocar una sola linea de codigo.
Nombre del colegio, niveles, planes de estudio, materias, escala de
calificaciones, horarios, conceptos de cobro, recargos y reglas de asistencia
se definen desde un asistente de instalacion y se editan despues desde la
pantalla de Configuracion.

## Estado del proyecto

Entrega por fases. **Las cinco fases estan completas y probadas.**

| Fase | Contenido | Estado |
|------|-----------|--------|
| 1 | Nucleo configurable: asistente de instalacion, motor de configuracion (59 parametros), autenticacion, roles, auditoria, estructura academica | Completa |
| 2 | Control escolar: alumnos, personal, materias y mapa curricular, grupos, clases, inscripciones, importador CSV | Completa |
| 3 | Academico: horarios con deteccion de choques, asistencia, calificaciones, boletas, promedios y ranking | Completa |
| 4 | Finanzas: cobros configurables, generacion de cargos, becas, recargos, pagos parciales, convenios, recibos y portales del alumno | Completa |
| 5 | Nomina del personal: conceptos, periodos, calculo, autorizacion, pago y recibo | Completa |

El modelo de datos de **las cinco fases ya esta creado** (`prisma/schema.prisma`),
de modo que las fases siguientes agregan pantallas y reglas, no migraciones de
fondo.

## Decisiones tomadas con el cliente

- **Stack:** Next.js 15 (App Router) + TypeScript + Prisma + PostgreSQL + Tailwind.
- **Despliegue:** una instalacion por colegio (base de datos propia por escuela).
- **Pais:** Mexico. Los recibos nacen como comprobante interno con la estructura
  CFDI 4.0 ya modelada, listos para timbrar cuando se conecte un PAC.
- **Pago en linea:** el modelo de datos guarda la configuracion de la pasarela,
  pero la integracion con el proveedor todavia no esta hecha. Hoy el cobro se
  registra en caja (efectivo, transferencia, tarjeta, deposito o cheque).
- **Niveles:** de preparatoria en adelante (bachillerato, licenciatura, posgrado,
  cursos), multiplantel y multiturno.
- **Evaluacion:** escala configurable (0 a 100 por omision), sin redondeo,
  calificacion minima aprobatoria definida por la institucion. Cada docente
  arma sus rubros y ponderaciones, pero entrega la calificacion final en el
  formato que pide la escuela: el sistema calcula una sugerida y el docente la
  confirma o la cambia.

## Cobros configurables

Ningun cobro esta escrito en el codigo. Para cada concepto el colegio define:

- **El motivo**: nombre, leyenda que aparece en el estado de cuenta y el recibo,
  y descripcion interna.
- **El monto**, con su IVA y sus claves del SAT si las necesita.
- **El tiempo**: periodicidad (una vez, mensual, bimestral, por periodo
  academico, semestral o anual), fecha del primer cargo, dia de vencimiento y
  cuantos cargos se generan.
- **A quien se le cobra**: todos, un nivel, un plan, un grado, un grupo o un
  alumno en particular.
- **Las reglas**: si es obligatorio, si genera recargo al vencerse y si acepta
  becas.

Ademas se pueden crear cargos sueltos a un alumno con motivo, monto y fecha
libres, sin pasar por el catalogo.

La generacion de cargos es idempotente: correrla dos veces no duplica nada,
porque omite los cargos que ya existen para ese alumno, concepto y fecha.

## Nomina

El colegio define sus propias percepciones y deducciones, cada una con monto
fijo o porcentaje del sueldo del periodo. El sueldo se prorratea dividiendo el
salario mensual entre los dias base que configure la escuela y multiplicando
por los dias que cubre el periodo; el prorrateo se puede apagar.

Cada recibo admite ajustes capturados a mano (bonos, prestamos, horas extra)
que sobreviven a un recalculo, porque quedan marcados como manuales.

**El sistema no calcula las tablas oficiales de ISR ni de seguridad social.**
Cada escuela captura sus propios porcentajes o montos. Para emitir el CFDI de
nomina hace falta conectar un PAC, que es trabajo aparte.

## Boletas

La boleta se genera como una hoja lista para imprimir, con el logo, los datos y
los colores que el colegio capturo. Desde el navegador se manda a la impresora
o se guarda como PDF. No requiere ninguna dependencia extra ni un servicio de
terceros.
- **Asistencia:** cada docente elige si pasa lista por dia o por clase, y si
  afecta o no la calificacion. El sistema avisa a los administrativos cuando un
  alumno acumula N faltas consecutivas (3 por omision, configurable).
- **Roles:** minimos — administrador, docente y alumno. El tutor no tiene cuenta
  propia: consulta con la cuenta del alumno.
- **Comunicacion:** solo notificaciones internas, sin correo saliente.
- **Nomina:** incluida como modulo (Fase 5).
- **Sin modulo de amonestaciones** (descartado por el cliente).

## Puesta en marcha

### Con Docker (recomendado)

```bash
cp .env.example .env
# Genera una clave y ponla en AUTH_SECRET:
openssl rand -base64 48
docker compose up --build
```

Abre http://localhost:3000 y sigue el asistente de instalacion.

### En local

Requiere Node 22+ y PostgreSQL 16+.

```bash
npm install
cp .env.example .env          # ajusta DATABASE_URL y AUTH_SECRET
npm run db:deploy             # aplica las migraciones
npm run dev
```

Al entrar por primera vez el sistema te lleva al asistente de instalacion.

### Datos de demostracion (opcional)

Para ver el sistema poblado sin capturar nada:

```bash
SEED_DEMO=1 npm run db:seed
```

Crea un colegio de ejemplo con estas cuentas (contrasena `Demo1234`):

| Rol | Usuario |
|-----|---------|
| Administrador | `admin` |
| Docente | `docente` |
| Alumno | `2026-0001` |

## Pruebas

Suites de extremo a extremo con navegador real (Playwright). Requieren el
servidor corriendo en `http://localhost:3000`.

```bash
npm run build && npm start        # en otra terminal
npm run prueba:humo               # 27 comprobaciones del nucleo (base con demo)
npm run prueba:control            # 28 comprobaciones de control escolar
npm run prueba:academico          # 40 comprobaciones del modulo academico (base recien sembrada)
npm run prueba:finanzas           # 40 comprobaciones de finanzas (base recien sembrada)
npm run prueba:integridad         # 27 comprobaciones de finanzas contra la base de datos
npm run prueba:nomina             # 42 comprobaciones de nomina (base recien sembrada)
npm run prueba:asistente          # 30 comprobaciones del asistente (base vacia)
```

`prueba:asistente` necesita una base **sin instalar**; ver `pruebas/README.md`.

## Estructura

```
prisma/schema.prisma      Modelo de datos completo de las 5 fases
prisma/seed.ts            Siembra de configuracion y datos de demostracion
src/lib/configuracion.ts  Motor de configuracion (catalogo de 59 parametros)
src/lib/auth.ts           Sesiones, bloqueo por intentos fallidos, RBAC
src/lib/bitacora.ts       Auditoria
src/app/instalacion/      Asistente de instalacion en 10 pasos
src/app/acceso/           Acceso al sistema
src/app/panel/            Panel, alumnos, personal, materias, grupos, importador,
                          horarios, asistencia, calificaciones, boletas,
                          finanzas, nomina, portales del alumno,
                          configuracion, estructura academica, bitacora
scripts/nueva-escuela.sh  Aprovisiona la base y el entorno de un colegio nuevo
pruebas/                  Suites de extremo a extremo
docs/                     Documentacion tecnica y plan de fases
```

## Seguridad

- Contrasenas con bcrypt (12 rondas).
- Sesiones firmadas (JWT en cookie httpOnly) **y** registradas en base, para
  poder revocarlas.
- Bloqueo temporal tras 5 intentos fallidos.
- Bitacora de auditoria obligatoria en configuracion, calificaciones, finanzas
  y nomina: quien, que, cuando, valor anterior y valor nuevo.
- Las cuentas creadas por el sistema nacen con contrasena temporal (la
  matricula o el numero de empleado) y el cambio es obligatorio en el primer
  acceso: hasta que se cambie, el usuario no puede navegar a ninguna otra
  pantalla.

## Dar de alta un colegio nuevo

Cada institucion tiene su propia base de datos. El script la prepara completa:

```bash
./scripts/nueva-escuela.sh colegio-vanguardia
```

Crea la base, aplica las migraciones y genera `.env.colegio-vanguardia` con una
clave de sesion propia. Despues se levanta la aplicacion con ese entorno y se
completa el asistente de instalacion.
