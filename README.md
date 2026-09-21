# Sistema de Gestion Escolar y Financiera Configurable

Sistema de control escolar y finanzas pensado para que **cualquier institucion**
lo instale y lo configure a su realidad, sin tocar una sola linea de codigo.
Nombre del colegio, niveles, planes de estudio, materias, escala de
calificaciones, horarios, conceptos de cobro, recargos y reglas de asistencia
se definen desde un asistente de instalacion y se editan despues desde la
pantalla de Configuracion.

## Estado del proyecto

Entrega por fases. **La Fase 1 esta completa y probada.**

| Fase | Contenido | Estado |
|------|-----------|--------|
| 1 | Nucleo configurable: asistente de instalacion, motor de configuracion (59 parametros), autenticacion, roles, auditoria, estructura academica | Completa |
| 2 | Control escolar: alumnos, personal, materias, grupos, clases, inscripciones, importador CSV | Pendiente |
| 3 | Academico: horarios con deteccion de choques, asistencia, captura de calificaciones, boletas | Pendiente |
| 4 | Finanzas: generacion de cargos, pagos parciales, recargos, becas, convenios, recibos y portales de alumno | Pendiente |
| 5 | Nomina del personal | Pendiente |

El modelo de datos de **las cinco fases ya esta creado** (`prisma/schema.prisma`),
de modo que las fases siguientes agregan pantallas y reglas, no migraciones de
fondo.

## Decisiones tomadas con el cliente

- **Stack:** Next.js 15 (App Router) + TypeScript + Prisma + PostgreSQL + Tailwind.
- **Despliegue:** una instalacion por colegio (base de datos propia por escuela).
- **Pais:** Mexico. Los recibos nacen como comprobante interno con la estructura
  CFDI 4.0 ya modelada, listos para timbrar cuando se conecte un PAC.
- **Niveles:** de preparatoria en adelante (bachillerato, licenciatura, posgrado,
  cursos), multiplantel y multiturno.
- **Evaluacion:** escala configurable (0 a 100 por omision), sin redondeo,
  calificacion minima aprobatoria definida por la institucion. Cada docente
  arma sus rubros y ponderaciones, pero entrega la calificacion final en el
  formato que pide la escuela.
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
npm run prueba:humo               # 27 comprobaciones sobre la base con demo
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
src/app/panel/            Panel, configuracion, estructura academica, bitacora
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
