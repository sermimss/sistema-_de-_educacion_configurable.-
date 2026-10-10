# Instala el sistema escolar en esta computadora con Windows.
#
#   Clic derecho sobre este archivo > "Ejecutar con PowerShell" como
#   administrador, o desde una consola con permisos de administrador:
#
#     powershell -ExecutionPolicy Bypass -File .\instalar-windows.ps1
#
# Deja el sistema arrancando solo al prender la computadora. Los demas
# dispositivos del colegio entran desde su navegador a
# http://<ip-de-esta-computadora>:3000
#
# AVISO: este instalador no pudo probarse en un Windows real durante el
# desarrollo. Correlo primero en una computadora de prueba.

param(
  [string]$Destino = "C:\SistemaEscolar",
  [int]$Puerto = 3000,
  [string]$Base = "escuela",
  # Clave de red del colegio. En la PRIMERA computadora se omite y el
  # instalador la genera; en las demas se pasa la misma que imprimio aquella,
  # para que se reconozcan y trabajen como un solo sistema.
  [string]$ClaveRed = ""
)

$ErrorActionPreference = "Stop"
$paquete = Split-Path -Parent $MyInvocation.MyCommand.Path

function Administrador {
  $identidad = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identidad)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Administrador)) {
  Write-Error "Este instalador necesita permisos de administrador."
  exit 1
}

Write-Host "==> Revisando requisitos"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Error "Falta Node.js (version 22 o mayor). Instalalo desde nodejs.org y vuelve a correr esto."
  exit 1
}
$versionNode = [int](& node -p "process.versions.node.split('.')[0]")
if ($versionNode -lt 22) {
  Write-Error "Node $versionNode es muy viejo; hace falta 22 o mayor."
  exit 1
}
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  Write-Error "Falta PostgreSQL. Instalalo desde postgresql.org y asegurate de que 'psql' este en el PATH."
  exit 1
}
Write-Host "    Node $(& node -v), PostgreSQL presente"

Write-Host "==> Preparando la base de datos '$Base'"
$bytes = New-Object byte[] 18
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$claveBd = [Convert]::ToBase64String($bytes) -replace '[/+=]', ''

$env:PGPASSWORD = Read-Host "Contrasena del usuario 'postgres' de PostgreSQL" -AsSecureString |
  ForEach-Object { [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($_)) }

$existeRol = & psql -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='escuela'"
if ($existeRol -ne "1") {
  & psql -U postgres -c "CREATE USER escuela WITH PASSWORD '$claveBd';" | Out-Null
  Write-Host "    usuario de base de datos creado"
} else {
  & psql -U postgres -c "ALTER USER escuela WITH PASSWORD '$claveBd';" | Out-Null
  Write-Host "    usuario de base de datos ya existia; se actualizo su contrasena"
}

$existeBase = & psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$Base'"
if ($existeBase -ne "1") {
  & psql -U postgres -c "CREATE DATABASE $Base OWNER escuela;" | Out-Null
  Write-Host "    base '$Base' creada"
} else {
  Write-Host "    base '$Base' ya existia; se conservan sus datos"
}

# Base donde el respaldo se prueba a si mismo cada noche. Se crea aqui, con el
# administrador de PostgreSQL, porque el usuario del sistema no puede crear
# bases: sin esta, la verificacion del respaldo se saltaria y el respaldo
# diria "listo" sin haber comprobado nada.
$baseVerificacion = "${Base}_verificacion"
$existeVerif = & psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$baseVerificacion'"
if ($existeVerif -ne "1") {
  & psql -U postgres -c "CREATE DATABASE $baseVerificacion OWNER escuela;" | Out-Null
  Write-Host "    base de verificacion de respaldos creada"
} else {
  Write-Host "    base de verificacion de respaldos ya existia"
}

Write-Host "==> Copiando archivos a $Destino"
$archivoEntorno = Join-Path $Destino 'entorno'

# Se decide ANTES de copiar si esto es una instalacion nueva o una
# actualizacion. Si se mirara despues, un archivo 'entorno' que viniera dentro
# del paquete pasaria por configuracion previa del colegio y el sistema
# quedaria con las claves de otra instalacion.
$actualizacion = Test-Path $archivoEntorno
$previo = $null
if ($actualizacion) { $previo = Get-Content $archivoEntorno }

New-Item -ItemType Directory -Force -Path $Destino | Out-Null
Copy-Item -Path (Join-Path $paquete '*') -Destination $Destino -Recurse -Force
Remove-Item (Join-Path $Destino 'instalar-linux.sh') -ErrorAction SilentlyContinue
Remove-Item (Join-Path $Destino 'instalar-windows.ps1') -ErrorAction SilentlyContinue

$cadenaBase = "DATABASE_URL=postgresql://escuela:$claveBd@localhost:5432/$Base`?schema=public"

# Se escribe en ASCII a proposito: con UTF8, Windows PowerShell antepone una
# marca invisible al inicio del archivo y el arranque leeria mal la primera
# linea, dejando al sistema sin conexion a la base.
if ($actualizacion) {
  # Se conserva la configuracion del colegio; solo cambia la contrasena de la
  # base, que se acaba de regenerar.
  ($previo -replace '^DATABASE_URL=.*', $cadenaBase) |
    Set-Content -Path $archivoEntorno -Encoding ASCII
  Write-Host "    se conservo la configuracion existente"
} else {
  $bytesSecreto = New-Object byte[] 48
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytesSecreto)
  $secreto = [Convert]::ToBase64String($bytesSecreto)

  # Identificador de esta computadora dentro de la red del colegio.
  $bytesSitio = New-Object byte[] 8
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytesSitio)
  $sitio = ($bytesSitio | ForEach-Object { $_.ToString("x2") }) -join ""

  # Clave compartida del colegio. La primera computadora la genera; en las
  # demas se pasa con -ClaveRed para que se reconozcan entre si.
  if ($ClaveRed) {
    $claveRed = $ClaveRed
  } else {
    $bytesClave = New-Object byte[] 18
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytesClave)
    $claveRed = [Convert]::ToBase64String($bytesClave) -replace '[/+=]', ''
  }

  @(
    $cadenaBase
    "AUTH_SECRET=$secreto"
    "PORT=$Puerto"
    "SESSION_HORAS=12"
    "SITIO_ID=$sitio"
    "CLAVE_RED=$claveRed"
  ) | Set-Content -Path $archivoEntorno -Encoding ASCII
  Write-Host "    archivo de configuracion creado"
}

# Se lee del archivo para mostrarla al final, tanto en instalacion nueva como
# en actualizacion.
$claveRedActual = ((Get-Content $archivoEntorno) -match '^CLAVE_RED=' |
  Select-Object -First 1) -replace '^CLAVE_RED=', ''

# Solo el administrador puede leer las claves.
$permisos = Get-Acl $archivoEntorno
$permisos.SetAccessRuleProtection($true, $false)
foreach ($cuenta in @("SYSTEM", "Administrators")) {
  $permisos.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule(
    $cuenta, "FullControl", "Allow")))
}
Set-Acl -Path $archivoEntorno -AclObject $permisos

# Arranque: decide el papel en la red, aplica migraciones y levanta el servidor.
$arranque = Join-Path $Destino 'arrancar.cmd'
@"
@echo off
cd /d "%~dp0"
for /f "usebackq tokens=1,* delims==" %%a in ("entorno") do set %%a=%%b
rem Escuchar en todas las interfaces para que lo alcancen las demas computadoras.
set HOSTNAME=0.0.0.0
set /p VERSION_SISTEMA=<VERSION

rem Si hay otra instalacion del colegio en esta red, solo una base queda
rem activa y esta computadora se suma a ella. Lo decide elegir-papel.
node scripts\elegir-papel.mjs papel.env >> registro.txt 2>&1
if errorlevel 3 (
  echo [arranque] no se abre el sistema aqui: hay una base activa en la red que no se alcanza. >> registro.txt
  exit /b 1
)
for /f "usebackq tokens=1,* delims==" %%a in ("papel.env") do set %%a=%%b
if not defined MANDA set MANDA=1

if "%MANDA%"=="1" (
  rem Al prender la computadora, PostgreSQL puede tardar en estar listo.
  for /l %%i in (1,1,3) do (
    echo [arranque] aplicando migraciones, intento %%i de 3 >> registro.txt
    node node_modules\prisma\build\index.js migrate deploy --schema prisma\schema.prisma >> registro.txt 2>&1 && goto :red
    rem Se espera con ping porque 'timeout' falla cuando no hay consola.
    ping -n 6 127.0.0.1 > nul
  )
  echo [arranque] ADVERTENCIA: no se pudieron aplicar las migraciones >> registro.txt
) else (
  echo [arranque] la base la administra %SITIO_QUE_MANDA%; aqui no se migra. >> registro.txt
)

:red
if defined CLAVE_RED if defined SITIO_ID (
  start "red escolar" /b node scripts\red-escolar.mjs anunciar >> registro.txt 2>&1
)

echo [arranque] sistema escolar escuchando en el puerto %PORT% (manda=%MANDA%) >> registro.txt
node server.js >> registro.txt 2>&1

rem Si el sistema se detiene, el anuncio se detiene con el: una computadora que
rem ya no sirve el sistema no debe seguir diciendo que tiene la base.
taskkill /f /fi "WINDOWTITLE eq red escolar" > nul 2>&1
"@ | Set-Content -Path $arranque -Encoding ASCII

Write-Host "==> Registrando el arranque automatico"
$accion = New-ScheduledTaskAction -Execute $arranque -WorkingDirectory $Destino
$disparador = New-ScheduledTaskTrigger -AtStartup
$opciones = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "SistemaEscolar" -Action $accion -Trigger $disparador `
  -Settings $opciones -User "SYSTEM" -RunLevel Highest -Force | Out-Null

Write-Host "==> Programando el respaldo diario"
$guionRespaldo = Join-Path $Destino 'respaldar-windows.ps1'
if (Test-Path $guionRespaldo) {
  $accionR = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$guionRespaldo`" -Destino `"$Destino`"" `
    -WorkingDirectory $Destino
  $disparadorR = New-ScheduledTaskTrigger -Daily -At 10pm
  $opcionesR = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries -StartWhenAvailable
  Register-ScheduledTask -TaskName "SistemaEscolarRespaldo" -Action $accionR `
    -Trigger $disparadorR -Settings $opcionesR -User "SYSTEM" -RunLevel Highest -Force | Out-Null
  Write-Host "    programado todos los dias a las 22:00"
} else {
  Write-Host "    AVISO: no se encontro respaldar-windows.ps1; sin respaldo automatico"
}

Write-Host "==> Abriendo el puerto $Puerto en el firewall"
New-NetFirewallRule -DisplayName "Sistema escolar" -Direction Inbound `
  -LocalPort $Puerto -Protocol TCP -Action Allow -ErrorAction SilentlyContinue | Out-Null

Write-Host "==> Arrancando"
Start-ScheduledTask -TaskName "SistemaEscolar"
Start-Sleep -Seconds 12

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' } | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "==================================================================="
Write-Host " Sistema escolar instalado"
Write-Host ""
Write-Host " Desde esta computadora:     http://localhost:$Puerto"
if ($ip) { Write-Host " Desde el resto del colegio: http://${ip}:$Puerto" }
Write-Host ""
$papel = ""
try {
  $papel = (Invoke-WebRequest -Uri "http://localhost:$Puerto/api/red/estado" -TimeoutSec 5 -UseBasicParsing).Content
} catch { }
if ($papel -match '"manda":false') {
  Write-Host " Esta computadora se SUMO a otra instalacion del colegio que ya"
  Write-Host " tenia los datos. Ambas muestran la misma informacion; su base"
  Write-Host " local quedo en reposo. No hay que correr el asistente otra vez."
} else {
  Write-Host " Esta computadora tiene la base activa del colegio."
  Write-Host " Abre esa direccion y completa el asistente de instalacion."
}
Write-Host ""
Write-Host " ---- Para instalar en otra computadora del colegio ----"
Write-Host ""
Write-Host " Clave de red del colegio:"
Write-Host ""
Write-Host "     $claveRedActual"
Write-Host ""
Write-Host " Corre el instalador en la otra computadora con esa clave:"
Write-Host ""
Write-Host "     .\instalar-windows.ps1 -ClaveRed '$claveRedActual'"
Write-Host ""
Write-Host " Con la misma clave se reconocen y se comportan como un solo"
Write-Host " sistema: la que arranque primero guarda los datos y las demas"
Write-Host " trabajan contra ella. Guarda esa clave."
Write-Host ""
Write-Host " FALTA UN PASO para que las demas computadoras puedan usar esta"
Write-Host " base: abrir PostgreSQL a la red local. En Windows hay que hacerlo"
Write-Host " a mano; viene explicado en LEEME.md, seccion 'Varias computadoras'."
Write-Host ""
Write-Host " ---- Respaldos ----"
Write-Host ""
Write-Host " Quedo programado todos los dias a las 22:00 y se verifica a si"
Write-Host " mismo restaurando la copia y comparando los datos."
Write-Host ""
Write-Host "     Ahora:     .\respaldar-windows.ps1"
Write-Host "     Restaurar: .\restaurar-windows.ps1"
Write-Host "     Ver tarea: Get-ScheduledTask SistemaEscolarRespaldo"
Write-Host ""
Write-Host " Correlo a mano una vez y revisa que termine en 'respaldo"
Write-Host " verificado'. Lo que no pudo probarse en el desarrollo es el"
Write-Host " Programador de tareas que lo dispara cada noche, asi que al dia"
Write-Host " siguiente confirma que la tarea corrio:"
Write-Host "     Get-ScheduledTaskInfo SistemaEscolarRespaldo"
Write-Host ""
Write-Host " Y agrega una USB o disco externo al archivo entorno:"
Write-Host "     RESPALDOS_EXTERNO=D:\respaldos-colegio"
Write-Host ""
Write-Host " Si algo falla, el detalle queda en: $Destino\registro.txt"
Write-Host ""
Write-Host " Detener:  Stop-ScheduledTask -TaskName SistemaEscolar"
Write-Host " Arrancar: Start-ScheduledTask -TaskName SistemaEscolar"
Write-Host "==================================================================="
