# Instalacion en una computadora del colegio

Esta guia es para usar el sistema **sin internet**, dentro del colegio.

En lugar de contratar un servicio en la nube, el sistema se instala en **una
computadora del colegio** (la llamaremos *el servidor*) y las demas —
direccion, control escolar, caja, docentes — entran desde su navegador
escribiendo la direccion de esa computadora. No se instala nada en las demas
computadoras: basta con Chrome, Edge o Firefox.

```
   Direccion  ─┐
   Caja       ─┤
   Docentes   ─┼──  red del colegio  ──►  Servidor (esta computadora)
   Prefectura ─┤                            · sistema escolar
   Biblioteca ─┘                            · base de datos
```

---

## 1. Que computadora usar como servidor

No hace falta un equipo especial, pero si conviene que sea:

- Una computadora que **quede prendida** durante el horario de oficina.
- Conectada a la red del colegio **por cable** de preferencia (el WiFi
  tambien funciona, pero es mas facil que cambie de direccion).
- Con **4 GB de memoria** o mas y unos **5 GB libres** en disco.
- Windows 10/11 o cualquier Linux reciente.

Un detalle importante: si esa computadora se apaga, el sistema deja de estar
disponible para las demas. Los datos **no se pierden** (quedan en su disco),
pero nadie puede entrar hasta que vuelva a prenderse.

## 2. Requisitos previos

El paquete trae adentro el sistema completo, pero hay dos programas que deben
estar en el servidor antes de instalar:

| Programa | Version | Para que sirve |
|---|---|---|
| Node.js | 22 o mayor | Ejecuta el sistema |
| PostgreSQL | 14 o mayor | Guarda los datos |

Se descargan una sola vez, desde cualquier computadora con internet, y se
copian en una USB si el servidor no tiene conexion:

- Node.js: <https://nodejs.org> (version LTS)
- PostgreSQL: <https://www.postgresql.org/download/>

Durante la instalacion de PostgreSQL se pide una contrasena para el usuario
`postgres`. **Anotala**: se usa una sola vez, al instalar.

## 3. El paquete

El archivo que recibe el colegio se llama asi:

```
sistema-escolar-<version>-<sistema>.tar.gz     (Linux)
sistema-escolar-<version>-<sistema>.zip        (Windows)
```

Ese paquete es **autocontenido**: lleva dentro el sistema ya compilado, sus
dependencias, las migraciones de la base y la herramienta que las aplica. La
instalacion **no descarga nada de internet**.

> El paquete se arma en el mismo sistema operativo donde se va a instalar,
> porque el motor de base de datos que usa el sistema es distinto en Windows y
> en Linux. Un paquete armado en Linux no sirve para Windows, y al reves.
> Quien arma el paquete corre `./scripts/empaquetar.sh` desde el codigo fuente.

## 4. Instalar en Linux

1. Copia el `.tar.gz` al servidor y descomprimelo:

   ```bash
   tar -xzf sistema-escolar-1.0.0-linux.tar.gz
   cd sistema-escolar
   ```

2. Corre el instalador con permisos de administrador:

   ```bash
   sudo ./instalar-linux.sh
   ```

El instalador hace todo lo demas: crea la base de datos, copia el sistema a
`/opt/sistema-escolar`, genera las claves de seguridad, y lo registra como
servicio para que **arranque solo al prender la computadora** y se reinicie
solo si llegara a caerse.

Al terminar imprime la direccion del sistema, por ejemplo:

```
 Desde esta computadora:      http://localhost:3000
 Desde el resto del colegio:  http://192.168.1.40:3000
```

Comandos utiles despues:

```bash
systemctl status sistema-escolar     # ver como va
journalctl -u sistema-escolar -f     # ver el registro en vivo
systemctl restart sistema-escolar    # reiniciarlo
systemctl stop sistema-escolar       # detenerlo
```

## 5. Instalar en Windows

1. Descomprime el `.zip` (clic derecho → Extraer todo).
2. Abre **PowerShell como administrador**: menu Inicio → escribe
   `PowerShell` → clic derecho → *Ejecutar como administrador*.
3. Entra a la carpeta y corre el instalador:

   ```powershell
   cd C:\Users\...\sistema-escolar
   .\instalar-windows.ps1
   ```

   Si Windows bloquea el script, permitelo solo para esta sesion:

   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```

El instalador pide la contrasena del usuario `postgres`, crea la base, copia
el sistema a `C:\SistemaEscolar`, abre el puerto en el Firewall de Windows y
registra una **tarea programada** para que arranque al prender la computadora.

Al terminar imprime la direccion, igual que en Linux.

Comandos utiles despues (PowerShell como administrador):

```powershell
Get-ScheduledTask SistemaEscolar          # ver si esta registrado
Start-ScheduledTask SistemaEscolar        # arrancarlo
Stop-ScheduledTask  SistemaEscolar        # detenerlo
```

> **Nota honesta:** el instalador de Windows fue escrito siguiendo la misma
> logica que el de Linux, pero **no pudo probarse en una computadora Windows
> real**. Antes de usarlo en el colegio, conviene probarlo en un equipo de
> prueba. El de Linux si esta probado de punta a punta.

## 6. Primer arranque: el asistente

Abre la direccion que imprimio el instalador. La primera vez el sistema
muestra el **asistente de instalacion**, que pide:

1. Nombre, clave, logo y datos fiscales del colegio.
2. La primera cuenta de administrador (correo y contrasena).
3. El ciclo escolar con el que arrancan.

A partir de ahi todo lo demas — niveles, planes de estudio, materias,
horarios, escalas de calificacion, conceptos de cobro, recargos, descuentos,
nomina — se configura desde el propio sistema. Nada esta fijo en el codigo.

El asistente **solo aparece una vez**. Si el sistema ya tiene una institucion
registrada, esa ruta redirige al inicio de sesion.

## 7. Como entran las demas computadoras

Escriben en su navegador la direccion que imprimio el instalador, por ejemplo
`http://192.168.1.40:3000`. Conviene guardarla como favorito.

Dos recomendaciones:

- **Fija la direccion IP** del servidor en el modem o router (a veces se llama
  "IP reservada" o "DHCP estatico"). Si no, la direccion puede cambiar sola al
  reiniciar y las demas computadoras dejarian de encontrarlo.
- Si quieren entrar escribiendo un nombre en lugar de numeros
  (`http://escuela:3000`), eso se configura en el router del colegio.

Desde **fuera** del colegio no se entra: el sistema vive en la red interna.
Eso es a proposito — es la contraparte de no depender de internet.

## 8. Varias computadoras, una sola informacion

Lo anterior alcanza para un colegio chico: una computadora guarda los datos y
las demas entran por el navegador. Pero si esa computadora se apaga, nadie
entra. Para no depender de una sola, el sistema se puede **instalar en varias**.

Cada instalacion trae su propia base de datos y puede trabajar sola. Lo que
hace la diferencia es la **clave de red del colegio**: con la misma clave, las
instalaciones se reconocen y se comportan como un solo sistema.

### Como funciona

```
   Al prender, cada computadora pregunta a la red:
   "¿alguien del colegio ya tiene los datos abiertos?"

        ┌─ Nadie contesta  ──►  abre su propia base y queda al mando
        │
        └─ Alguien contesta ──►  se suma a esa: muestra los mismos datos
                                 y deja su base local en reposo
```

No hay que designar una computadora como servidor ni configurar nada: **la
primera que arranque guarda los datos** y las demas trabajan contra ella. Da
igual cual sea. Todas muestran lo mismo y se puede trabajar desde cualquiera:
lo que captura caja aparece al instante en direccion.

### Por que solo una guarda los datos

Esto es deliberado y conviene entenderlo. Si cada computadora escribiera en su
propia base, dos cajas cobrando a la vez generarian **el mismo folio de recibo
dos veces**, y el mismo alumno tendria **dos saldos distintos** segun donde se
consultara. En control escolar eso es molesto; en finanzas y facturacion es
inadmisible. Por eso en una red solo una base esta activa.

La contraparte honesta: si la computadora que tiene los datos se apaga, las
demas **no abren el sistema**. No es un descuido — es la decision de no partir
los datos en dos. El sistema lo dice con claridad en lugar de abrir una copia
paralela que despues nadie podria reconciliar.

### Instalar la segunda computadora

Al terminar, el instalador de la primera imprime la clave de red:

```
 Clave de red del colegio:

     7fKq2mXpR4vLnB8dTcHs

 Corre el instalador en la otra computadora pasandole esa clave:

     sudo CLAVE_RED='7fKq2mXpR4vLnB8dTcHs' ./instalar-linux.sh
```

En Windows:

```powershell
.\instalar-windows.ps1 -ClaveRed '7fKq2mXpR4vLnB8dTcHs'
```

Eso es todo. La segunda computadora encuentra a la primera, se suma, y no pide
correr el asistente otra vez.

**Guarda esa clave.** Es lo que impide que un aparato ajeno conectado al WiFi
del colegio se haga pasar por el sistema y mande a todos a una pantalla falsa.
Sin clave, cada instalacion queda como un colegio aparte.

Para saber en cualquier momento quien tiene los datos:

```
http://<direccion-de-la-computadora>:3000/api/red/estado
```

### Falta un paso en Windows

En Linux el instalador abre PostgreSQL a la red local solo. En **Windows hay
que hacerlo a mano**, una vez, en la computadora que vaya a guardar los datos:

1. Abre `C:\Program Files\PostgreSQL\16\data\postgresql.conf` con el Bloc de
   notas (como administrador) y deja la linea:

   ```
   listen_addresses = '*'
   ```

2. En `C:\Program Files\PostgreSQL\16\data\pg_hba.conf`, agrega al final, con
   la red del colegio (si las computadoras son `192.168.1.x`, se escribe
   `192.168.1.0/24`):

   ```
   host escuela escuela 192.168.1.0/24 scram-sha-256
   ```

3. Reinicia el servicio de PostgreSQL desde *Servicios* de Windows. El primer
   cambio **no toma efecto con recargar**: hace falta reiniciar.

Esa linea es a proposito lo mas estrecha posible: solo esa red, solo el usuario
del sistema, solo esa base, y siempre con contrasena.

### Lo que esto asume

Que la red del colegio no es hostil. Quien este conectado a ella y conozca la
contrasena puede llegar a la base. Si el colegio comparte su WiFi con
visitantes, la computadora de los datos deberia estar en una red aparte.

### Si dos arrancan al mismo segundo

Cada computadora espera un lapso propio antes de declararse al mando y vuelve a
mirar la red, asi que la segunda alcanza a ver a la primera. La ventana en que
las dos podrian creerse al mando es de fracciones de segundo, pero **no es
cero**: no es un protocolo de consenso, es una eleccion sencilla y basta para
una red de colegio. Si quieres evitarla por completo, prende primero la
computadora de los datos y las demas despues.

## 9. Respaldos

Esto es lo mas importante de toda la guia. Los datos viven en el disco de esa
computadora; si el disco falla y no hay respaldo, no hay de donde recuperarlos.

Si el colegio tiene varias computadoras instaladas (punto 8), el respaldo se
hace **en la que tiene los datos**, no en todas: las demas no guardan nada. Se
sabe cual es con `/api/red/estado`.

**Linux** — respaldo diario automatico:

```bash
sudo crontab -e
```

y agrega esta linea (respalda a las 10 de la noche, conserva 30 dias):

```
0 22 * * * su postgres -c "pg_dump escuela" | gzip > /var/respaldos/escuela-$(date +\%F).sql.gz; find /var/respaldos -name '*.sql.gz' -mtime +30 -delete
```

Antes, crea la carpeta: `sudo mkdir -p /var/respaldos`

**Windows** — respaldo manual o por tarea programada:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U escuela escuela > D:\respaldos\escuela.sql
```

**Y copia esos respaldos fuera de la computadora**: una USB, un disco externo o
la nube. Un respaldo que vive en el mismo disco que los datos no protege de
nada.

Para restaurar:

```bash
gunzip -c escuela-2026-03-01.sql.gz | psql -U escuela escuela
```

## 10. Actualizaciones

Cuando llega una version nueva:

1. **Respalda primero** (punto 9).
2. Descomprime el paquete nuevo.
3. Corre el mismo instalador otra vez.

El instalador conserva la base de datos y la configuracion, y aplica solas las
migraciones que falten. No hay que volver a correr el asistente.

## 11. Si algo falla

| Sintoma | Que revisar |
|---|---|
| No abre desde otra computadora | Firewall del servidor y que ambas esten en la misma red |
| No abre ni en el servidor | `systemctl status sistema-escolar` (Linux) o la tarea programada (Windows) |
| Abre pero dice que no hay base | PostgreSQL no arranco: `systemctl status postgresql` |
| Dejo de encontrarse la direccion | La IP del servidor cambio; ver punto 7 |
| Dice "hay una base activa en la red que no se alcanza" | La computadora con los datos esta apagada o fuera de la red. Prendela, o revisa el cable/WiFi. Es a proposito: ver punto 8 |
| Una computadora quedo como colegio aparte | Se instalo sin la clave de red. Reinstalala pasando `CLAVE_RED` |
| La segunda computadora no alcanza la base | Falta abrir PostgreSQL a la red local; en Windows es a mano (punto 8) |

En **Windows**, el detalle de cada arranque queda en
`C:\SistemaEscolar\registro.txt`. Es el primer archivo que hay que abrir si el
sistema no responde. En **Linux** lo mismo se ve con
`journalctl -u sistema-escolar -f`.

Las rutas `/api/salud` y `/api/red/estado` dicen en texto claro como esta el
sistema, su base de datos y su papel en la red del colegio. La primera sirve
para distinguir "el sistema no arranco" de "el sistema arranco pero no ve la
base"; la segunda, para saber cual computadora tiene los datos.

## 12. Servicio local o servicio en la nube

Las dos formas funcionan con el mismo codigo; cambia quien se hace cargo de
que.

| | Instalado en el colegio | En la nube (Render) |
|---|---|---|
| Internet | No hace falta | Indispensable |
| Se entra desde casa | No | Si |
| Respaldos | Los hace el colegio | Los hace el proveedor |
| Si se apaga la computadora | Se cae el sistema | No aplica |
| Costo mensual | Ninguno | El del plan |
| Actualizar | Correr el instalador | Automatico al publicar |

Para la opcion en la nube, ver `docs/despliegue.md`.
