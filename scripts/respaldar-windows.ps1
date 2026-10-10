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
#  Que tan probado esta esto:
#
#  SI se probo, en PowerShell 7 contra un PostgreSQL de verdad: el respaldo,
#  la verificacion por restauracion, la comparacion de conteos, la copia al
#  disco externo, la rotacion, y los casos en que debe negarse (base sin
#  colegio cargado, falta la base de verificacion, disco externo ausente).
#  Este guion no usa ningun comando exclusivo de Windows.
#
#  NO se probo en Windows: las rutas propias del sistema (C:\Program Files,
#  C:\SistemaEscolar) y el Programador de tareas que lo dispara cada noche.
#
#  Aun asi, antes de depender de el: correlo a mano una vez y revisa que
#  termine en "respaldo verificado". Un respaldo en el que no se puede
#  confiar es peor que no tener ninguno, porque da falsa tranquilidad.
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

# El sistema puede estar apagado, y entonces la pregunta de arriba no contesta
# nada. Asi que no se confia solo en eso: se mira la base misma. Una
# computadora secundaria tiene su base local vacia, y respaldarla daria un
# archivo de unos kilobytes que parece un respaldo correcto y no sirve.
if ($psql) {
  $hayColegio = (& $psql -tAc 'SELECT instalado FROM "Institucion" WHERE id=1' `
                 --host=$servidor --port=$puertoBd --username=$usuarioBd $base 2>$null |
                 Out-String).Trim()
  if ($hayColegio -ne "t") {
    Decir "la base '$base' de esta computadora no tiene ningun colegio cargado."
    Decir "No se respalda: un archivo de una base vacia parece un respaldo"
    Decir "correcto y no sirve para nada."
    if ($papel) {
      Decir "Si esta computadora se suma a otra del colegio, el respaldo va alla."
    } else {
      Decir "Revisa que el sistema este corriendo y el colegio instalado."
    }
    exit 0
  }
}

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
  # Se usa una base de verificacion fija, creada por el instalador y propiedad
  # del usuario del sistema. No se crea una temporal cada vez porque el usuario
  # de la aplicacion normalmente NO tiene permiso de crear bases: la
  # verificacion se saltaria en silencio y el respaldo diria "listo" sin haber
  # comprobado nada, que es exactamente lo que este guion existe para evitar.
  $verificacion = "${base}_verificacion"
  Decir "verificando: se restaura en '$verificacion' y se comparan los datos"

  function ContarEn($cualBase, $tabla) {
    $r = & $psql -tAc "SELECT count(*) FROM `"$tabla`"" `
         --host=$servidor --port=$puertoBd --username=$usuarioBd $cualBase 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return ($r | Out-String).Trim()
  }

  # ¿Existe la base de verificacion?
  & $psql -tAc "SELECT 1" --host=$servidor --port=$puertoBd `
    --username=$usuarioBd $verificacion 2>$null | Out-Null
  $hayBase = ($LASTEXITCODE -eq 0)

  if (-not $hayBase) {
    # Se intenta crearla, por si este usuario si puede.
    & $psql -q -c "CREATE DATABASE `"$verificacion`"" --host=$servidor `
      --port=$puertoBd --username=$usuarioBd postgres 2>$null | Out-Null
    $hayBase = ($LASTEXITCODE -eq 0)
  }

  if (-not $hayBase) {
    Decir ""
    Decir "=============================================================="
    Decir " LA COPIA NO SE PUDO VERIFICAR"
    Decir ""
    Decir " Falta la base '$verificacion', y el usuario '$usuarioBd' no"
    Decir " tiene permiso para crearla. El archivo del respaldo SI se"
    Decir " guardo, pero nadie comprobo que sirva para restaurar."
    Decir ""
    Decir " Para arreglarlo, una sola vez, como administrador de PostgreSQL:"
    Decir "   createdb -O $usuarioBd $verificacion"
    Decir "=============================================================="
    # Se sale con error a proposito: asi el Programador de tareas marca la
    # corrida como fallida y alguien lo ve, en lugar de pasar inadvertido.
    exit 2
  }

  # Se vacia y se restaura dentro. El dueño de la base puede recrear su
  # esquema sin permisos especiales.
  & $psql -q --set ON_ERROR_STOP=on -c "DROP SCHEMA public CASCADE" `
    -c "CREATE SCHEMA public" --host=$servidor --port=$puertoBd `
    --username=$usuarioBd $verificacion 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { Morir "no se pudo preparar la base de verificacion '$verificacion'" }

  & $pgRestore --no-owner --no-privileges --dbname=$verificacion `
    --host=$servidor --port=$puertoBd --username=$usuarioBd "$archivo" 2>$null
  $restauro = ($LASTEXITCODE -eq 0)
  if (-not $restauro) { Morir "el respaldo NO sirve para restaurar." }

  $diferencias = 0
  foreach ($tabla in @("Institucion","Usuario","Alumno","Empleado","Cargo",
                       "Pago","Inscripcion","CalificacionPeriodo","RegistroAsistencia")) {
    $origen = ContarEn $base $tabla
    $copia = ContarEn $verificacion $tabla
    if ($null -eq $origen -or $null -eq $copia) {
      Decir "  $tabla : no se pudo comparar"; $diferencias++
    } elseif ($origen -ne $copia) {
      Decir "  $tabla : original $origen, copia $copia  <-- NO COINCIDE"; $diferencias++
    } else {
      Decir "  $tabla : $origen"
    }
  }

  if ($diferencias -ne 0) {
    Morir "el respaldo no coincide con la base en $diferencias tabla(s). NO confies en el."
  }
  Decir "respaldo verificado: la copia restaura y coincide con la base"
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
