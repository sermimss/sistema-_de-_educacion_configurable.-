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
- **Despliegue:** en internet, una plataforma multicolegio (cada colegio con su propio espacio en la base y su propia direccion, ver `docs/plataforma.md`); en las computadoras del colegio, una instalacion por colegio.
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

### En Render

El repositorio trae `render.yaml`. En Render: **New > Blueprint**, conecta el
repositorio y confirma. Render crea el servicio y su base de datos, genera la
clave de sesion, aplica las migraciones y levanta el sistema; solo queda abrir
la URL y completar el asistente de instalacion.

El blueprint sale con el plan gratuito para que puedas probarlo. **Antes de
cargar datos reales hay que subirlo a un plan de paga**: el servicio gratuito
se duerme y la base de datos gratuita caduca. Los detalles estan en
[docs/despliegue.md](docs/despliegue.md).

### Instalado en una computadora del colegio (sin internet)

El sistema tambien se entrega como paquete instalable, para colegios que
prefieren no depender de internet. Se instala en una computadora del colegio y
las demas entran desde su navegador por la red interna.

```bash
./scripts/empaquetar.sh           # paquete de Linux  -> dist/
./scripts/empaquetar-windows.sh   # paquete de Windows -> dist-windows/
```

El de Windows se arma **desde Linux**, asi que el colegio no compila nada:
recibe un `.zip`, lo descomprime y corre el instalador. Es posible porque el
servidor compilado de Next es el mismo JavaScript en los dos sistemas, el motor
de consultas de Prisma para Windows se pide en el esquema (`binaryTargets`), y
el de migraciones se baja del sitio oficial de Prisma. Los binarios de `sharp`
que trae Next son de Linux, pero este sistema no usa `next/image`, asi que se
excluyen. El empaquetado **aborta** si queda cualquier archivo de Linux dentro
o si aparece un `.env`.

El paquete es autocontenido: lleva el servidor compilado, sus dependencias, las
migraciones y la herramienta que las aplica. En la computadora del colegio:

```bash
tar -xzf sistema-escolar-0.1.0-linux.tar.gz
cd sistema-escolar
sudo ./instalar-linux.sh            # Linux
```

```powershell
.\instalar-windows.ps1              # Windows, en PowerShell como administrador
```

El instalador crea la base de datos, genera las claves de la instalacion, deja
el sistema arrancando solo al prender la computadora e imprime la direccion
para el resto del colegio. Al reinstalar encima conserva los datos y la
configuracion, y solo aplica las migraciones que falten.

Requisitos previos en esa computadora: Node.js 22 o mayor y PostgreSQL 14 o
mayor. Paso a paso, respaldos y solucion de problemas en
[`docs/instalacion-local.md`](docs/instalacion-local.md).

#### Varias computadoras, una sola informacion

Cada instalacion trae su propia base y puede trabajar sola. Si varias comparten
la **clave de red del colegio**, se reconocen entre si y se comportan como un
solo sistema: la primera que arranque guarda los datos y las demas trabajan
contra ella.

```bash
sudo ./instalar-linux.sh                              # primera: imprime la clave
sudo CLAVE_RED='<la que imprimio>' ./instalar-linux.sh  # las demas
```

No hay que designar un servidor ni configurar nada mas: el papel se decide en
cada arranque. `GET /api/red/estado` dice cual computadora tiene los datos.

Solo una base queda activa a proposito. Si cada computadora escribiera en la
suya, dos cajas cobrando a la vez repetirian folios de recibo y el mismo alumno
tendria dos saldos distintos. La contraparte: si la computadora con los datos
se apaga, las demas no abren el sistema, en lugar de abrir una copia paralela
que nadie podria reconciliar despues.

Los anuncios en la red van firmados con esa clave, para que un aparato ajeno
conectado al WiFi del colegio no pueda hacerse pasar por el sistema ni obtener
las credenciales de la base.

#### Respaldos verificados

El instalador deja el respaldo programado todos los dias a las 22:00. Cada
noche saca la copia y **la restaura en una base temporal para comparar los
datos tabla por tabla**: una copia que nunca se probo no es un respaldo. Si no
restaura o no coincide, falla ruidosamente en lugar de quedarse callado.

```bash
sudo /opt/sistema-escolar/respaldar.sh            # a mano
sudo /opt/sistema-escolar/restaurar.sh            # lista los respaldos
sudo /opt/sistema-escolar/restaurar.sh <archivo>  # restaura ese
systemctl list-timers respaldo-escolar.timer      # cuando toca el proximo
```

Restaurar pide escribir el nombre de la base para confirmar, guarda una copia
del estado actual antes de reemplazar nada, detiene el sistema mientras trabaja
y lo vuelve a levantar.

Medido: una base con 504 alumnos y un ciclo completo de pase de lista (285,000
registros de asistencia) ocupa 43 MB en disco y **1.2 MB comprimida**. El
almacenamiento no es el costo; la disciplina si. Falta un paso que el sistema
no puede hacer solo: conectar una USB o disco externo y ponerlo en `entorno`
como `RESPALDOS_EXTERNO`, porque un respaldo en el mismo disco que los datos no
protege de que ese disco falle.

> El paquete se arma en el mismo sistema operativo donde se va a instalar: el
> motor de base de datos de Prisma es distinto en Windows y en Linux.
>
> El instalador de Linux esta probado de punta a punta. Del lado de Windows,
> el respaldo y la restauracion estan probados en PowerShell 7 contra un
> PostgreSQL real, pero el instalador usa piezas que solo existen en Windows
> (tareas programadas, firewall, permisos de archivo) y esas no pudieron
> probarse: conviene correrlo primero en un equipo de prueba.

### Con Docker

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
npm run prueba:plataforma         # 37 comprobaciones de la plataforma multicolegio (base vacia, MODO_PLATAFORMA=1)
npm run prueba:grupos             # 33 comprobaciones de grupos con calendario y horario (base recien sembrada)
npm run prueba:asistente          # 29 comprobaciones del asistente (base vacia)
```

`prueba:asistente` necesita una base **sin instalar**; ver `pruebas/README.md`.

## Estructura

```
prisma/schema.prisma      Modelo de datos completo de las 5 fases
prisma/seed.ts            Siembra de configuracion y datos de demostracion
src/lib/configuracion.ts  Motor de configuracion (catalogo de 59 parametros)
src/lib/auth.ts           Sesiones, bloqueo por intentos fallidos, RBAC
src/lib/bitacora.ts       Auditoria
src/app/instalacion/      Asistente de instalacion en 8 pasos
src/app/acceso/           Acceso al sistema
src/app/panel/            Panel, alumnos, personal, materias, grupos, importador,
                          horarios, asistencia, calificaciones, boletas,
                          finanzas, nomina, portales del alumno,
                          configuracion, estructura academica, bitacora
scripts/nueva-escuela.sh  Aprovisiona la base y el entorno de un colegio nuevo
pruebas/                  Suites de extremo a extremo
docs/                     Documentacion tecnica, plan de fases y despliegue
render.yaml               Blueprint de Render para el primer colegio
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

En la plataforma en internet, con un codigo de alta desde `/plataforma` (ver
`docs/plataforma.md`). Para una instalacion aparte, de un solo colegio, el
script prepara su base completa:

```bash
./scripts/nueva-escuela.sh colegio-vanguardia
```

Crea la base, aplica las migraciones y genera `.env.colegio-vanguardia` con una
clave de sesion propia. Despues se levanta la aplicacion con ese entorno y se
completa el asistente de instalacion.
