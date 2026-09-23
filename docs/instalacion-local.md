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

## 8. Respaldos

Esto es lo mas importante de toda la guia. Los datos viven en el disco de esa
computadora; si el disco falla y no hay respaldo, no hay de donde recuperarlos.

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

## 9. Actualizaciones

Cuando llega una version nueva:

1. **Respalda primero** (punto 8).
2. Descomprime el paquete nuevo.
3. Corre el mismo instalador otra vez.

El instalador conserva la base de datos y la configuracion, y aplica solas las
migraciones que falten. No hay que volver a correr el asistente.

## 10. Si algo falla

| Sintoma | Que revisar |
|---|---|
| No abre desde otra computadora | Firewall del servidor y que ambas esten en la misma red |
| No abre ni en el servidor | `systemctl status sistema-escolar` (Linux) o la tarea programada (Windows) |
| Abre pero dice que no hay base | PostgreSQL no arranco: `systemctl status postgresql` |
| Dejo de encontrarse la direccion | La IP del servidor cambio; ver punto 7 |

En **Windows**, el detalle de cada arranque queda en
`C:\SistemaEscolar\registro.txt`. Es el primer archivo que hay que abrir si el
sistema no responde. En **Linux** lo mismo se ve con
`journalctl -u sistema-escolar -f`.

La ruta `/api/salud` dice en texto claro como esta el sistema y su base de
datos. Sirve para distinguir "el sistema no arranco" de "el sistema arranco
pero no ve la base".

## 11. Servicio local o servicio en la nube

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
