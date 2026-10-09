# Respaldo de la base del colegio, con verificacion. Version para Windows.
#
#   .\respaldar-windows.ps1
#
# Hace lo mismo que respaldar.sh en Linux: saca la copia, la verifica
# restaurandola en una base temporal y comparando los conteos, saca una
# segunda copia fuera de esta computadora si esta disponible, y rota las
# viejas.
#
# ======================================================================
#  AVISO: este guion NO pudo probarse en una computadora Windows real.
#  Un respaldo en el que no se puede confiar es peor que no tener ninguno,
#  porque da una falsa tranquilidad. ANTES de depender de el:
#
#    1. Correlo a mano y revisa que termine en "respaldo verificado".
#    2. Restaura esa copia en un equipo de prueba y entra al sistema.
#
#  Solo despues programalo. El de Linux si esta probado de punta a punta.
# ======================================================================
#
# A diferencia del de Linux, aqui la copia se guarda en el formato propio de
# PostgreSQL (.dump) en lugar de .sql.gz, porque ya viene comprimido y no hace
# falta ninguna herramienta extra. Una copia hecha en Windows se restaura con
# el guion de Windows, y una hecha en Linux con el de Linux.

param(
  [string]$Destino = "C:\SistemaEscolar",
  [string]$Respaldos = "",
  [int]$Dias = 30,
  [string]$RespaldosExterno = "",
  [switch]$SinVerificar
)

$ErrorActionPreference = "Stop"

function Decir($texto) { Write-Host "[respaldo] $texto" }
function Morir($texto) { Write-Host "[respaldo] ERROR: $texto" -ForegroundColor Red; exit 1 }

# --- Configuracion, del archivo 'entorno' --------------------------------

$archivoEntorno = Join-Path $Destino "entorno"
if (-not (Test-Path $archivoEntorno)) { Morir "no se encontro $archivoEntorno" }

$config = @{}
foreach ($linea in Get-Content $archivoEntorno) {
  if ($linea -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    $config[$Matches[1]] = $Matches[2]
  }
}

$cadena = $config["DATABASE_URL"]
if (-not $cadena) { Morir "falta DATABASE_URL en el archivo 'entorno'" }
if (-not $Respaldos) {
  $Respaldos = if ($config["RESPALDOS"]) { $config["RESPALDOS"] } else { Join-Path $Destino "respaldos" }
}
if (-not $RespaldosExterno -and $config["RESPALDOS_EXTERNO"]) {
  $RespaldosExterno = $config["RESPALDOS_EXTERNO"]
}
if ($config["RESPALDOS_DIAS"]) { $Dias = [int]$config["RESPALDOS_DIAS"] }
$puertoSistema = if ($config["PORT"]) { $config["PORT"] } else { "3000" }

# De la cadena de conexion salen usuario, contrasena, servidor, puerto y base.
$uri = [Uri]$cadena
$usuarioBd = [Uri]::UnescapeDataString($uri.UserInfo.Split(':')[0])
$claveBd = [Uri]::UnescapeDataString($uri.UserInfo.Split(':')[1])
$servidor = $uri.Host
$puertoBd = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
$base = $uri.AbsolutePath.TrimStart('/')
if (-not $base) { Morir "no se pudo leer el nombre de la base de DATABASE_URL" }

# --- Si esta computadora no guarda los datos, no hay nada que respaldar ---

try {
  $papel = (Invoke-WebRequest -Uri "http://localhost:$puertoSistema/api/red/estado" `
            -TimeoutSec 5 -UseBasicParsing).Content
  if ($papel -match '"manda":false') {
    Decir "esta computadora no guarda los datos; el respaldo se hace alla."
    exit 0
  }
} catch { }

# --- Herramientas de PostgreSQL ------------------------------------------

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
if (-not $pgDump) { Morir "no se encontro pg_dump. Instala PostgreSQL o agregalo al PATH." }

$env:PGPASSWORD = $claveBd

# --- 1. La copia ----------------------------------------------------------

New-Item -ItemType Directory -Force -Path $Respaldos | Out-Null
$sello = Get-Date -Format "yyyy-MM-dd_HHmm"
$archivo = Join-Path $Respaldos "$base-$sello.dump"

Decir "copiando '$base' a $archivo"
& $pgDump --no-owner --no-privileges --format=custom --file="$archivo" `
  --host=$servidor --port=$puertoBd --username=$usuarioBd $base
if ($LASTEXITCODE -ne 0) {
  Remove-Item $archivo -ErrorAction SilentlyContinue
  Morir "pg_dump fallo; no se dejo un archivo a medias"
}
if (-not (Test-Path $archivo) -or (Get-Item $archivo).Length -lt 1024) {
  Remove-Item $archivo -ErrorAction SilentlyContinue
  Morir "la copia quedo vacia o demasiado pequeña; se borro"
}
$tamano = [math]::Round((Get-Item $archivo).Length / 1MB, 2)
Decir "copia lista ($tamano MB)"

# --- 2. Verificacion: restaurar y comparar -------------------------------

if ($SinVerificar) {
  Decir "AVISO: verificacion omitida."
} elseif (-not $pgRestore -or -not $psql) {
  Decir "AVISO: falta pg_restore o psql; la copia NO se pudo verificar."
} else {
  $temporal = "verificacion_respaldo_$(Get-Random -Maximum 99999)"
  Decir "verificando: se restaura en una base temporal y se comparan los datos"

  function ContarEn($cualBase, $tabla) {
    $r = & $psql -tAc "SELECT count(*) FROM `"$tabla`"" `
         --host=$servidor --port=$puertoBd --username=$usuarioBd $cualBase 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return ($r | Out-String).Trim()
  }

  function BorrarTemporal {
    & $psql -q -c "DROP DATABASE IF EXISTS `"$temporal`"" `
      --host=$servidor --port=$puertoBd --username=$usuarioBd postgres 2>$null | Out-Null
  }

  BorrarTemporal
  & $psql -q -c "CREATE DATABASE `"$temporal`"" `
    --host=$servidor --port=$puertoBd --username=$usuarioBd postgres 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Decir "AVISO: no se pudo crear la base temporal (el usuario '$usuarioBd' quiza"
    Decir "no tiene permiso de crear bases). La copia quedo SIN VERIFICAR."
  } else {
    & $pgRestore --no-owner --no-privileges --dbname=$temporal `
      --host=$servidor --port=$puertoBd --username=$usuarioBd "$archivo" 2>$null
    $restauro = ($LASTEXITCODE -eq 0)

    $diferencias = 0
    if ($restauro) {
      foreach ($tabla in @("Institucion","Usuario","Alumno","Empleado","Cargo",
                           "Pago","Inscripcion","CalificacionPeriodo","RegistroAsistencia")) {
        $origen = ContarEn $base $tabla
        $copia = ContarEn $temporal $tabla
        if ($null -eq $origen -or $null -eq $copia) {
          Decir "  $tabla : no se pudo comparar"; $diferencias++
        } elseif ($origen -ne $copia) {
          Decir "  $tabla : original $origen, copia $copia  <-- NO COINCIDE"; $diferencias++
        } else {
          Decir "  $tabla : $origen"
        }
      }
    }

    BorrarTemporal

    if (-not $restauro) { Morir "el respaldo NO sirve para restaurar." }
    if ($diferencias -ne 0) { Morir "el respaldo no coincide con la base en $diferencias tabla(s). NO confies en el." }
    Decir "respaldo verificado: la copia restaura y coincide con la base"
  }
}

# --- 3. Segunda copia fuera de esta computadora --------------------------

if ($RespaldosExterno) {
  if (Test-Path $RespaldosExterno) {
    try {
      Copy-Item $archivo -Destination $RespaldosExterno -ErrorAction Stop
      Decir "copia tambien en $RespaldosExterno"
    } catch {
      Decir "AVISO: no se pudo copiar a $RespaldosExterno"
    }
  } else {
    # La falla silenciosa clasica: la USB se desconecto hace meses, los
    # respaldos siguen saliendo "bien", y el dia del incendio no hay nada
    # afuera. Por eso se avisa fuerte.
    Decir "AVISO IMPORTANTE: $RespaldosExterno no esta disponible."
    Decir "El respaldo quedo SOLO en esta computadora. Conecta el disco o la"
    Decir "USB y vuelve a correr esto."
  }
} else {
  Decir "AVISO: no hay copia fuera de esta computadora. Un respaldo en el"
  Decir "mismo disco que los datos no protege de que ese disco falle."
}

# --- 4. Rotacion ---------------------------------------------------------

$limite = (Get-Date).AddDays(-$Dias)
$viejos = Get-ChildItem (Join-Path $Respaldos "$base-*.dump") -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -lt $limite }
if ($viejos) {
  $viejos | Remove-Item -Force
  Decir "se borraron $($viejos.Count) respaldo(s) de mas de $Dias dias"
}

$cuantos = (Get-ChildItem (Join-Path $Respaldos "$base-*.dump") -ErrorAction SilentlyContinue).Count
Decir "listo. $cuantos respaldo(s) guardados en $Respaldos"
