# Arquitectura

## Principio rector

Ningun dato propio de una escuela vive en el codigo. Todo lo que cambia de una
institucion a otra esta en la base de datos y se captura en el asistente de
instalacion o en la pantalla de Configuracion.

Esto se sostiene sobre tres piezas:

1. **Tabla `Institucion`** (registro unico): nombre, logo, colores, datos de
   contacto y datos fiscales.
2. **Tabla `Configuracion`** (llave/valor tipado): reglas de negocio ajustables.
   El catalogo maestro esta en `src/lib/configuracion.ts`; agregar una entrada
   ahi la hace aparecer sola en la interfaz, con su etiqueta, ayuda y tipo.
3. **Catalogos propios**: niveles, planes, grados, materias, escalas,
   conceptos de cobro, recargos, becas, modulos de horario. Son tablas, no
   enumeraciones del codigo.

## Capas

```
src/app/         Rutas (App Router). Server Components por omision.
  instalacion/   Asistente inicial. Se autobloquea una vez instalado.
  acceso/        Inicio y cierre de sesion.
  panel/         Aplicacion autenticada, con menu segun el rol.
src/lib/         Reglas y accesos a datos reutilizables.
src/components/  Componentes de interfaz.
prisma/          Esquema, migraciones y siembra.
```

Las mutaciones se hacen con Server Actions, no con endpoints REST: la
validacion con Zod corre en el servidor aunque el formulario ya haya validado
en el navegador.

## Sesiones

JWT firmado (jose) en cookie `httpOnly`, `sameSite=lax`, `secure` en
produccion. Ademas cada sesion se guarda en la tabla `Sesion`, lo que permite
revocarla: el middleware valida la firma (rapido, sin base) y las paginas
validan contra la tabla con `sesionActual()`.

Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.

## Configuracion y cache

Los valores de configuracion se memorizan **por peticion** (`cache()` de React),
no en un cache de proceso. Asi, si el sistema corre en varias instancias, un
cambio hecho en una no deja valores viejos en otra.

## Auditoria

`registrarBitacora()` deja constancia de quien, que, cuando, con valor anterior
y nuevo. Es obligatoria en configuracion, calificaciones, finanzas y nomina. Si
la escritura de la bitacora falla, se registra en consola pero **no** se tumba
la operacion principal.

## Decisiones que conviene conocer

- **Una instalacion por colegio.** No hay columna `escuelaId` en las tablas: el
  aislamiento es por base de datos. Es decision del cliente y simplifica las
  consultas, a cambio de un despliegue por escuela.
- **Campos `creadoPor` / `capturadoPor` sin llave foranea.** Guardan el id del
  usuario como entero simple. Evita decenas de relaciones inversas sobre
  `Usuario`; la trazabilidad fuerte vive en la bitacora.
- **Dinero en `Decimal(12,2)`**, nunca en punto flotante.
- **Calificaciones en `Decimal(6,3)`**, para que el redondeo sea una decision
  configurable y no un efecto del tipo de dato.
- **El tutor no tiene cuenta.** Se modela como contacto del alumno
  (`Tutor`), con bandera de responsable financiero.

## Por que una base por colegio y no multi-tenant

Se evaluo usar una sola instalacion con `escuelaId` en cada tabla. Se decidio
mantener **una base de datos por colegio** por tres razones:

1. **Aislamiento.** Aqui viven expedientes de menores y datos financieros. Una
   base por escuela hace imposible por construccion que una consulta mal escrita
   muestre datos de otra institucion; con multi-tenant ese riesgo vive en cada
   `findMany` que alguien escriba de aqui en adelante.
2. **Costo por consulta.** Multi-tenant obliga a filtrar por escuela en todas
   las consultas y a volver compuestos todos los indices unicos (matricula,
   claves de plan, folios). Es un impuesto permanente sobre el desarrollo.
3. **El objetivo ya esta cubierto.** "Que cualquier escuela lo use" lo resuelve
   el asistente de instalacion, no el multi-tenant.

El costo de esta decision es operativo: cada colegio nuevo necesita su base y
su despliegue. Se mitiga con `scripts/nueva-escuela.sh`, que crea base,
migraciones y archivo de entorno en un comando.

**Cuando convendria cambiar:** si el sistema se vende como servicio con alta
automatica a decenas de escuelas, el costo de infraestructura y operacion de un
despliegue por cliente supera al del filtrado por escuela. Ese cambio es mas
barato cuanto antes se haga.
