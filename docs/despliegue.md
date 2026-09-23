# Despliegue

Cada colegio tiene su propia instalacion: su servicio y su base de datos. Este
documento cubre Render, que es la via mas corta, y el despliegue propio con
Docker.

## Render (recomendado para empezar)

El repositorio trae `render.yaml`, un blueprint que describe el servicio web y
su base de datos. Render lo lee y crea todo solo.

### Pasos

1. En Render: **New > Blueprint**.
2. Conecta el repositorio y elige la rama. El blueprint trae fijada la rama
   donde vive el codigo (`branch:` en `render.yaml`); si integras a `main`,
   actualiza ese valor o Render no encontrara la rama.
3. Render detecta `render.yaml` y muestra lo que va a crear: el servicio web
   `sistema-escolar` y la base `escuela-db`. Confirma.
4. Espera el primer despliegue. Render instala, compila, aplica las
   migraciones y levanta el servidor.
5. Abre la URL que te asigna y completa el **asistente de instalacion**: ahi el
   colegio captura su nombre, logo, niveles, planes, ciclo, escala, horarios,
   conceptos de cobro y la cuenta de administrador.

No hay que capturar `AUTH_SECRET` a mano: Render la genera y nadie mas la ve.
`DATABASE_URL` se conecta sola a la base del blueprint.

### Si el despliegue falla

Los tres tropiezos mas comunes, ya resueltos en este repositorio, por si
reaparecen al tocar la configuracion:

- **La rama no existe.** `render.yaml` declara una rama concreta; tiene que
  existir en el repositorio.
- **`npm ci` aborta.** Pasa cuando `package.json` y `package-lock.json` no
  coinciden. Se arregla corriendo `npm install` y subiendo el lock.
- **El build no encuentra `next`, `prisma` o `tailwindcss`.** Pasa si se fija
  `NODE_ENV=production` como variable del servicio: npm omite las
  devDependencies, y ahi viven las herramientas de compilacion. El blueprint
  no la fija a proposito.

### Si responde 502

Un 502 significa que el servicio desplego pero el proceso no esta contestando.
La causa mas comun en el primer despliegue es que las migraciones fallen porque
la base todavia se esta creando: si el arranque fuera
`prisma migrate deploy && node server.js`, un fallo ahi deja el servicio sin
proceso y el resultado es un 502 permanente.

Por eso el arranque pasa por `scripts/arrancar.sh`, que reintenta las
migraciones un par de veces y levanta el servidor de todos modos. Con eso el
sistema responde y `/api/salud` dice que pasa:

- `"baseDeDatos":"ok"` — todo bien.
- `"baseDeDatos":"sin-conexion"` — la base no es alcanzable. Revisa que
  `DATABASE_URL` apunte a la base del blueprint y que esta ya exista.
- `"baseDeDatos":"lenta"` — contesta, pero tarda mas de dos segundos.

Si aun asi da 502, mira los registros del servicio: si el proceso murio, el
motivo esta ahi. En el plan gratuito tambien hay 502 pasajeros mientras el
servicio despierta tras dormirse por inactividad.

### Que revisar despues del primer despliegue

- `https://<tu-servicio>.onrender.com/api/salud` debe responder
  `{"ok":true,"baseDeDatos":"ok","instalado":false}` antes de instalar, y con
  `"instalado":true` despues.
- La primera pantalla debe ser el asistente. Si ves el acceso, es que la base
  ya tiene una institucion instalada.

### Antes de cargar datos reales

El blueprint sale con `plan: free` para que puedas probarlo sin costo, pero:

- El servicio gratuito **se duerme** tras unos minutos sin trafico y el primer
  acceso despues tarda.
- La base de datos gratuita de Render **caduca**. Si el colegio ya capturo
  alumnos y pagos, eso es perdida de datos.

Antes de operar de verdad, sube el servicio y la base a un plan de paga en el
panel de Render, o cambia `plan: free` por el plan que contrates y vuelve a
aplicar el blueprint.

### Un segundo colegio

Cada colegio necesita su propio servicio y su propia base. El script genera el
blueprint con los nombres correspondientes:

```bash
./scripts/nueva-escuela.sh --render colegio-vanguardia
git add render-colegio-vanguardia.yaml && git commit -m "Blueprint de colegio-vanguardia" && git push
```

Despues, en Render: **New > Blueprint** apuntando a ese archivo.

## Con Docker, en tu propio servidor

```bash
cp .env.example .env
openssl rand -base64 48        # pega el resultado en AUTH_SECRET
docker compose up --build
```

`docker-compose.yml` levanta PostgreSQL y la aplicacion. El contenedor aplica
las migraciones al arrancar.

## En un servidor sin Docker

Requiere Node 22+ y PostgreSQL 16+.

```bash
./scripts/nueva-escuela.sh colegio-vanguardia    # crea base y .env.colegio-vanguardia
npm ci
npm run build
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
env $(grep -v '^#' .env.colegio-vanguardia | xargs) npx prisma migrate deploy
env $(grep -v '^#' .env.colegio-vanguardia | xargs) node .next/standalone/server.js
```

Los dos comandos de copia son necesarios porque la compilacion usa la salida
`standalone` de Next.js, que no incluye los archivos estaticos.

## Respaldos

El sistema no gestiona respaldos. En Render se contratan aparte; en servidor
propio, con `pg_dump`. Antes de operar con datos reales conviene tener un
respaldo diario automatico y haber probado una restauracion.

## Variables de entorno

| Variable | Obligatoria | Para que sirve |
|---|---|---|
| `DATABASE_URL` | si | Conexion a PostgreSQL |
| `AUTH_SECRET` | si | Firma las sesiones. Minimo 32 caracteres |
| `SESSION_HORAS` | no | Duracion de la sesion, 12 por omision |
| `NODE_ENV` | no | `production` en despliegue |

`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` solo hacen falta si el colegio
activa el acceso con Google desde Configuracion.
