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
  [string]$Base = "escuela"
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
  @(
    $cadenaBase
    "AUTH_SECRET=$secreto"
    "PORT=$Puerto"
    "SESSION_HORAS=12"
  ) | Set-Content -Path $archivoEntorno -Encoding ASCII
  Write-Host "    archivo de configuracion creado"
}

# Solo el administrador puede leer las claves.
$permisos = Get-Acl $archivoEntorno
$permisos.SetAccessRuleProtection($true, $false)
foreach ($cuenta in @("SYSTEM", "Administrators")) {
  $permisos.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule(
    $cuenta, "FullControl", "Allow")))
}
Set-Acl -Path $archivoEntorno -AclObject $permisos

# Arranque: aplica migraciones y levanta el servidor.
$arranque = Join-Path $Destino 'arrancar.cmd'
@"
@echo off
cd /d "%~dp0"
for /f "usebackq tokens=1,* delims==" %%a in ("entorno") do set %%a=%%b
rem Escuchar en todas las interfaces para que lo alcancen las demas computadoras.
set HOSTNAME=0.0.0.0
rem Al prender la computadora, PostgreSQL puede tardar en estar listo.
for /l %%i in (1,1,3) do (
  echo [arranque] aplicando migraciones, intento %%i de 3 >> registro.txt
  node node_modules\prisma\build\index.js migrate deploy --schema prisma\schema.prisma >> registro.txt 2>&1 && goto :servidor
  rem Se espera con ping porque 'timeout' falla cuando no hay consola.
  ping -n 6 127.0.0.1 > nul
)
echo [arranque] ADVERTENCIA: no se pudieron aplicar las migraciones >> registro.txt
:servidor
echo [arranque] sistema escolar escuchando en el puerto %PORT% >> registro.txt
node server.js >> registro.txt 2>&1
"@ | Set-Content -Path $arranque -Encoding ASCII

Write-Host "==> Registrando el arranque automatico"
$accion = New-ScheduledTaskAction -Execute $arranque -WorkingDirectory $Destino
$disparador = New-ScheduledTaskTrigger -AtStartup
$opciones = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "SistemaEscolar" -Action $accion -Trigger $disparador `
  -Settings $opciones -User "SYSTEM" -RunLevel Highest -Force | Out-Null

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
Write-Host " Abre esa direccion y completa el asistente de instalacion."
Write-Host ""
Write-Host " Si algo falla, el detalle queda en: $Destino\registro.txt"
Write-Host ""
Write-Host " Detener:  Stop-ScheduledTask -TaskName SistemaEscolar"
Write-Host " Arrancar: Start-ScheduledTask -TaskName SistemaEscolar"
Write-Host "==================================================================="
