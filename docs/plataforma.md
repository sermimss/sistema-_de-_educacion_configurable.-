# Plataforma multicolegio

Un solo sistema en internet para muchos colegios. Piensalo como un edificio:
la plataforma es el edificio y cada colegio es una habitacion con su propia
puerta. Quien tiene la llave de una habitacion solo entra a esa.

## Como se activa

Con la variable `MODO_PLATAFORMA=1` (ya viene en `render.yaml`). Sin ella el
sistema es la instalacion de un solo colegio, como en los paquetes para las
computadoras del colegio y su red local; ese modo no cambia.

| Variable | Para que |
|---|---|
| `MODO_PLATAFORMA` | `1` para muchos colegios. |
| `PLATAFORMA_CLAVE_ARRANQUE` | Clave para crear la cuenta del dueno la primera vez (minimo 12 caracteres). Se pone a mano en el tablero del hospedaje. |
| `DOMINIO_PLATAFORMA` | Opcional. Con un dominio propio, cada colegio entra tambien por `<direccion>.<dominio>`. |
| `PLATAFORMA_NOMBRE` | Opcional. Nombre que aparece en la pagina de entrada. |

## Lo que ve cada quien

**La entrada** (`/`) pregunta siempre lo mismo a quien no tiene sesion abierta:

- *Ya tengo un colegio registrado*: se escribe la direccion del colegio (o se
  pega completa) y lleva a su inicio de sesion.
- *Quiero contratar el servicio*: pide el codigo de alta.

Quien ya tiene sesion abierta entra directo a su colegio.

**La puerta de cada colegio** es `https://<plataforma>/<direccion>` (o
`https://<direccion>.<dominio>` con dominio propio). Es la direccion que el
colegio comparte con su personal y alumnos: lleva al inicio de sesion con el
nombre y logo de ese colegio.

**El dueno** entra en `/plataforma`. La primera vez crea su cuenta con la
clave de arranque. Desde ahi:

- genera **codigos de alta** (cada uno sirve para un solo colegio y se muestra
  una sola vez);
- ve la lista de colegios, su direccion, su estado y cuantos alumnos tienen;
- **marca como pagado** un colegio para abrirlo, lo **suspende** o lo
  **reactiva**.

El dueno no ve calificaciones, alumnos, pagos ni ningun otro dato de los colegios.

## Alta de un colegio

1. El dueno genera un codigo y se lo entrega al cliente.
2. El cliente abre la plataforma, elige *Quiero contratar el servicio* y
   escribe el codigo.
3. Se abre el asistente de configuracion de siempre, con un campo mas: la
   **direccion web del colegio** (se propone sola a partir del nombre).
4. Al terminar, el sistema le muestra la direccion propia de su colegio.
5. El colegio queda **pendiente de pago**: la direccion funciona, pero nadie
   puede iniciar sesion.
6. Cuando el dueno lo marca como pagado, el colegio se abre.

Si el cliente cierra el navegador a medias, vuelve a escribir el mismo codigo
y continua. Ya terminado, el codigo deja de servir.

Estados de un colegio: `CONFIGURANDO` → `PENDIENTE_PAGO` → `ACTIVO`, y
`SUSPENDIDO` cuando el dueno lo suspende.

## Como se separan los datos

Cada colegio tiene su propio **esquema** de PostgreSQL (`colegio_1`,
`colegio_2`...): las mismas tablas, pero aparte. El sistema decide en cada
solicitud a que esquema hablar:

- en el panel, por el colegio que va **firmado dentro de la sesion**: cambiar
  a mano la direccion o una cookie no abre el panel de otro colegio;
- en el inicio de sesion, por la direccion por la que se entro;
- en el asistente, por el codigo de alta canjeado (tambien firmado).

Por eso dos colegios pueden tener un usuario con el mismo nombre (por ejemplo
`direccion` o la matricula `2026-0001`) sin mezclarse.

Los datos de la plataforma (colegios, codigos de alta y la cuenta del dueno)
viven en el esquema `plataforma`. De los codigos solo se guarda su huella, no
el codigo.

## Actualizaciones

Al arrancar, `scripts/arrancar.sh` aplica las migraciones y despues pone al
dia el esquema de cada colegio en segundo plano (`scripts/migrar-colegios.mjs`).

## Dominio propio (mas adelante)

Sin dominio, cada colegio entra por `https://sistema-escolar.onrender.com/<direccion>`.
Para usar `<direccion>.tudominio.com`:

1. Compra un dominio.
2. En Render, en el servicio, agrega dos dominios propios: `tudominio.com` y
   `*.tudominio.com` (Render emite los certificados solo; el dominio raiz
   tambien debe apuntar a Render para que el comodin funcione).
3. En tu proveedor de dominio crea los registros que Render te indique.
4. Pon `DOMINIO_PLATAFORMA=tudominio.com` en el entorno del servicio.

Las direcciones `/<direccion>` siguen funcionando y llevan al subdominio.
