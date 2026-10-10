# Restaura un respaldo del colegio. Version para Windows.
#
#   .\restaurar-windows.ps1                       lista los respaldos
#   .\restaurar-windows.ps1 -Archivo <ruta>       restaura ese respaldo
#
# ESTO BORRA LOS DATOS ACTUALES y los reemplaza por los del respaldo. Pide
# escribir el nombre de la base para confirmar: el dia en que hace falta
# restaurar la gente esta nerviosa, y no conviene que un enter de mas borre el
# trabajo de la semana.
#
# Antes de reemplazar nada saca una copia de lo que hay, para que equivocarse
# de archivo no sea irreversible.
#
# Restaura los respaldos hechos por respaldar-windows.ps1 (archivos .dump).
# Los de Linux son .sql.gz y se restauran con restaurar.sh.

param(
  [string]$Archivo = "",
  [string]$Destino = "C:\SistemaEscolar",
  [string]$Respaldos = "",
  [string]$Tarea = "SistemaEscolar"
)

$ErrorActionPreference = "Stop"

function Decir($texto) { Write-Host "[restaurar] $texto" }
function Morir($texto) { Write-Host "[restaurar] ERROR: $texto" -ForegroundColor Red; exit 1 }

# --- Configuracion --------------------------------------------------------

$archivoEntorno = Join-Path $Destino "entorno"
if (-not (Test-Path $archivoEntorno)) { Morir "no se encontro $archivoEntorno" }

$config = @{}
foreach ($linea in Get-Content $archivoEntorno) {
  if ($linea -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $config[$Matches[1]] = $Matches[2] }
}

$cadena = $config["DATABASE_URL"]
if (-not $cadena) { Morir "falta DATABASE_URL en el archivo 'entorno'" }
if (-not $Respaldos) {
  $Respaldos = if ($config["RESPALDOS"]) { $config["RESPALDOS"] } else { Join-Path $Destino "respaldos" }
}
$puertoSistema = if ($config["PORT"]) { $config["PORT"] } else { "3000" }

$uri = [Uri]$cadena
$usuarioBd = [Uri]::UnescapeDataString($uri.UserInfo.Split(':')[0])
$claveBd = [Uri]::UnescapeDataString($uri.UserInfo.Split(':')[1])
$servidor = $uri.Host
$puertoBd = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
$base = $uri.AbsolutePath.TrimStart('/')
if (-not $base) { Morir "no se pudo leer el nombre de la base de DATABASE_URL" }

function BuscarHerramienta($nombre) {
  $cmd = Get-Command $nombre -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $encontrado = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$nombre.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
  if ($encontrado) { return $encontrado.FullName }
  return $null
}

$pgDump = BuscarHerramienta "pg_dump"
$pgRestore = BuscarHerramienta "pg_restore"
$psql = BuscarHerramienta "psql"
if (-not $pgRestore -or -not $psql -or -not $pgDump) {
  Morir "faltan herramientas de PostgreSQL (pg_dump, pg_restore o psql) en el PATH."
}

$env:PGPASSWORD = $claveBd

# --- Sin argumento: mostrar que hay --------------------------------------

if (-not $Archivo) {
  Write-Host ""
  Write-Host "Respaldos disponibles en $Respaldos :"
  Write-Host ""
  $lista = Get-ChildItem (Join-Path $Respaldos "*.dump") -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending
  if ($lista) {
    foreach ($r in $lista) {
      Write-Host ("  {0:dd/MM/yyyy HH:mm}  {1,8:N2} MB  {2}" -f `
        $r.LastWriteTime, ($r.Length / 1MB), $r.FullName)
    }
  } else {
    Write-Host "  (ninguno)"
  }
  Write-Host ""
  Write-Host "Para restaurar uno:"
  Write-Host "  .\restaurar-windows.ps1 -Archivo <ruta>"
  Write-Host ""
  exit 0
}

if (-not (Test-Path $Archivo)) { Morir "no existe el archivo '$Archivo'" }

# pg_restore sabe leer el indice del archivo: si no puede, el respaldo esta
# dañado y no vale la pena tocar la base.
& $pgRestore --list $Archivo > $null 2>&1
if ($LASTEXITCODE -ne 0) {
  Morir "'$Archivo' esta dañado o no es un respaldo de PostgreSQL"
}

$info = Get-Item $Archivo

# --- Confirmacion --------------------------------------------------------

Write-Host ""
Write-Host "==================================================================="
Write-Host " Esto va a REEMPLAZAR todos los datos de la base '$base'"
Write-Host " por el contenido de:"
Write-Host ""
Write-Host "     $($info.FullName)"
Write-Host ("     ({0:N2} MB, del {1:dd/MM/yyyy HH:mm})" -f ($info.Length / 1MB), $info.LastWriteTime)
Write-Host ""
Write-Host " Lo que haya ahora en '$base' se guarda primero en una copia de"
Write-Host " seguridad, por si te equivocaste de archivo."
Write-Host "==================================================================="
Write-Host ""
$confirmacion = Read-Host "Escribe el nombre de la base para confirmar ($base)"
if ($confirmacion -ne $base) {
  Decir "no coincide; no se toco nada."
  exit 1
}

# --- Detener el sistema para que nadie escriba durante la restauracion ----

$detenido = $false
if (Get-Command Stop-ScheduledTask -ErrorAction SilentlyContinue) {
  try {
    $t = Get-ScheduledTask -TaskName $Tarea -ErrorAction Stop
    if ($t.State -eq "Running") {
      Decir "deteniendo el sistema para que nadie escriba mientras se restaura"
      Stop-ScheduledTask -TaskName $Tarea
      $detenido = $true
      Start-Sleep -Seconds 3
    }
  } catch { }
}

function VolverALevantar {
  if ($detenido) {
    Decir "levantando el sistema otra vez"
    try { Start-ScheduledTask -TaskName $Tarea } catch {
      Decir "AVISO: no se pudo levantar la tarea '$Tarea'; hazlo a mano."
    }
  }
}

# --- Copia de seguridad de lo que hay ahora ------------------------------

New-Item -ItemType Directory -Force -Path $Respaldos | Out-Null
$antes = Join-Path $Respaldos ("$base-ANTES-DE-RESTAURAR-" + (Get-Date -Format "yyyy-MM-dd_HHmm") + ".dump")
Decir "guardando el estado actual en $antes"
& $pgDump --no-owner --no-privileges --format=custom --file="$antes" `
  --host=$servidor --port=$puertoBd --username=$usuarioBd $base
if ($LASTEXITCODE -ne 0) {
  Remove-Item $antes -ErrorAction SilentlyContinue
  VolverALevantar
  Morir "no se pudo respaldar el estado actual; no se restauro nada"
}
Decir ("copia de seguridad lista ({0:N2} MB)" -f ((Get-Item $antes).Length / 1MB))

# --- Restaurar -----------------------------------------------------------

Decir "vaciando y restaurando '$base'"
# Se vacia recreando el esquema CON EL USUARIO DEL SISTEMA, para que las tablas
# queden a su nombre. Hecho como administrador de PostgreSQL, el sistema no
# alcanzaria ninguna tabla y la restauracion pareceria exitosa estando rota.
& $psql -q --set ON_ERROR_STOP=on -c "DROP SCHEMA public CASCADE" -c "CREATE SCHEMA public" `
  --host=$servidor --port=$puertoBd --username=$usuarioBd $base 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Decir ""
  Decir "No se pudo vaciar la base. NADA SE PERDIO: los datos siguen como"
  Decir "estaban y tu copia esta en $antes"
  Decir ""
  Decir "Lo mas comun es que el esquema de la base no sea del usuario del"
  Decir "sistema, porque alguien lo recreo como administrador de PostgreSQL."
  Decir "Se arregla una sola vez, como administrador:"
  Decir ""
  Decir "   psql -U postgres -d $base -c 'ALTER SCHEMA public OWNER TO $usuarioBd'"
  Decir ""
  Decir "Y despues vuelve a correr esta restauracion."
  VolverALevantar
  Morir "la base no se pudo vaciar"
}

& $pgRestore --no-owner --no-privileges --dbname=$base `
  --host=$servidor --port=$puertoBd --username=$usuarioBd $Archivo
if ($LASTEXITCODE -ne 0) {
  Decir "la restauracion fallo o quedo incompleta."
  Decir "Para volver a como estaba antes:"
  Decir "  .\restaurar-windows.ps1 -Archivo `"$antes`""
  VolverALevantar
  Morir "restauracion incompleta"
}

# --- Comprobar que el sistema alcanza los datos --------------------------

function Consultar($sql) {
  $r = & $psql -tAc $sql --host=$servidor --port=$puertoBd --username=$usuarioBd $base 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  return ($r | Out-String).Trim()
}

$institucion = Consultar 'SELECT nombre FROM "Institucion" WHERE id=1'
$alumnos = Consultar 'SELECT count(*) FROM "Alumno"'
$usuarios = Consultar 'SELECT count(*) FROM "Usuario"'

if (-not $institucion) {
  Decir "ATENCION: los datos entraron pero el sistema no los alcanza."
  Decir "Suele ser un problema de permisos en la base. Para volver atras:"
  Decir "  .\restaurar-windows.ps1 -Archivo `"$antes`""
}

VolverALevantar

if ($detenido) {
  $salud = ""
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 2
    try {
      $salud = (Invoke-WebRequest -Uri "http://localhost:$puertoSistema/api/salud" `
                -TimeoutSec 5 -UseBasicParsing).Content
    } catch { }
    if ($salud -match '"instalado":true') { break }
  }
  if ($salud -match '"instalado":true') {
    Decir "el sistema ya responde con el colegio restaurado"
  } else {
    Decir "AVISO: el sistema todavia no reporta el colegio. Revisa /api/salud."
  }
}

Write-Host ""
Write-Host "==================================================================="
Write-Host " Restauracion terminada"
Write-Host ""
Write-Host "   Colegio:   $(if ($institucion) { $institucion } else { '(sin institucion: revisa el archivo)' })"
Write-Host "   Alumnos:   $(if ($alumnos) { $alumnos } else { '?' })"
Write-Host "   Usuarios:  $(if ($usuarios) { $usuarios } else { '?' })"
Write-Host ""
Write-Host " El estado anterior quedo guardado en:"
Write-Host "   $antes"
Write-Host ""
Write-Host " Entra al sistema y revisa que la informacion sea la que esperabas"
Write-Host " antes de que el personal vuelva a capturar."
Write-Host "==================================================================="
