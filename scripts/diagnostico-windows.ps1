# Recoge en un solo archivo todo lo que hace falta para saber si el sistema
# quedo bien instalado en esta computadora con Windows.
#
#   .\diagnostico-windows.ps1
#
# Deja un archivo 'diagnostico-escolar.txt' en esta misma carpeta. Ese archivo
# es el que hay que mandar.
#
# NO INCLUYE NINGUNA CONTRASENA. Del archivo de configuracion solo se reportan
# los nombres de los ajustes presentes y, de la cadena de conexion, unicamente
# el servidor, el puerto y el nombre de la base. Ni la contrasena de la base ni
# la clave de firma de sesiones ni la clave de red salen aqui.

param(
  [string]$Destino = "C:\SistemaEscolar",
  [string]$Salida = ""
)

if (-not $Salida) {
  $Salida = Join-Path (Get-Location) "diagnostico-escolar.txt"
}

$lineas = New-Object System.Collections.Generic.List[string]
function Anotar($texto) { $lineas.Add([string]$texto) }
function Titulo($texto) {
  Anotar ""
  Anotar ("===== " + $texto + " " + ("=" * [Math]::Max(0, 60 - $texto.Length)))
}

Write-Host "Recogiendo informacion..." -ForegroundColor Cyan

Anotar "DIAGNOSTICO DEL SISTEMA ESCOLAR"
Anotar ("Fecha: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
Anotar "Este archivo NO contiene contrasenas."

# --- 1. La computadora ---------------------------------------------------

Titulo "1. La computadora"
try {
  $so = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
  Anotar ("Windows:      " + $so.Caption + " (" + $so.Version + ")")
  Anotar ("Arquitectura: " + $so.OSArchitecture)
  Anotar ("Memoria:      " + [math]::Round($so.TotalVisibleMemorySize / 1MB, 1) + " GB")
} catch {
  Anotar ("No se pudo leer la version de Windows: " + $_.Exception.Message)
}
Anotar ("PowerShell:   " + $PSVersionTable.PSVersion + "  (edicion " + $PSVersionTable.PSEdition + ")")
try {
  $disco = Get-PSDrive C -ErrorAction Stop
  Anotar ("Disco C:      " + [math]::Round($disco.Free / 1GB, 1) + " GB libres de " + [math]::Round(($disco.Used + $disco.Free) / 1GB, 1) + " GB")
} catch { }

# --- 2. Requisitos -------------------------------------------------------

Titulo "2. Requisitos"
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  Anotar ("Node.js:      " + (& node -v) + "   en " + $node.Source)
} else {
  Anotar "Node.js:      NO ENCONTRADO en el PATH"
}

foreach ($h in @("psql","pg_dump","pg_restore")) {
  $c = Get-Command $h -ErrorAction SilentlyContinue
  if ($c) {
    Anotar ("$h".PadRight(14) + (& $c.Source --version 2>$null) + "   en " + $c.Source)
  } else {
    $enArchivos = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$h.exe" -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($enArchivos) {
      Anotar ("$h".PadRight(14) + "no esta en el PATH, pero existe en " + $enArchivos.FullName)
    } else {
      Anotar ("$h".PadRight(14) + "NO ENCONTRADO")
    }
  }
}

try {
  $servicioPg = Get-Service -Name "postgresql*" -ErrorAction Stop
  foreach ($s in $servicioPg) { Anotar ("Servicio:     " + $s.Name + " -> " + $s.Status) }
} catch { Anotar "Servicio:     no se encontro ningun servicio postgresql*" }

# --- 3. La instalacion ---------------------------------------------------

Titulo "3. La instalacion en $Destino"
if (-not (Test-Path $Destino)) {
  Anotar "LA CARPETA NO EXISTE. El instalador no llego a copiar los archivos."
} else {
  foreach ($f in @("server.js","arrancar.cmd","entorno","VERSION","SISTEMA",
                   "respaldar-windows.ps1","restaurar-windows.ps1",
                   "prisma\schema.prisma",
                   "node_modules\.prisma\client\query_engine-windows.dll.node",
                   "node_modules\@prisma\engines\schema-engine-windows.exe",
                   "scripts\elegir-papel.mjs")) {
    $ruta = Join-Path $Destino $f
    if (Test-Path $ruta) {
      Anotar ("OK      " + $f + "   (" + [math]::Round((Get-Item $ruta).Length / 1KB, 1) + " KB)")
    } else {
      Anotar ("FALTA   " + $f)
    }
  }
  $v = Join-Path $Destino "VERSION"
  if (Test-Path $v) { Anotar ("Version instalada: " + (Get-Content $v -Raw).Trim()) }

  # Ajustes presentes: SOLO los nombres, nunca los valores.
  $entorno = Join-Path $Destino "entorno"
  if (Test-Path $entorno) {
    Anotar ""
    Anotar "Ajustes presentes en 'entorno' (solo nombres, sin valores):"
    $hayBom = $false
    $primeros = [System.IO.File]::ReadAllBytes($entorno) | Select-Object -First 3
    if ($primeros.Count -ge 3 -and $primeros[0] -eq 0xEF -and $primeros[1] -eq 0xBB -and $primeros[2] -eq 0xBF) {
      $hayBom = $true
    }
    foreach ($linea in Get-Content $entorno) {
      if ($linea -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $nombre = $Matches[1]
        $valor = $Matches[2]
        # De la cadena de conexion solo servidor, puerto y base. Nunca la clave.
        if ($nombre -eq "DATABASE_URL") {
          try {
            $u = [Uri]$valor
            Anotar ("  $nombre -> servidor " + $u.Host + ", puerto " + $u.Port + ", base " + $u.AbsolutePath.TrimStart('/') + ", usuario " + $u.UserInfo.Split(':')[0])
          } catch { Anotar "  $nombre -> presente, pero no se pudo interpretar" }
        } elseif ($nombre -in @("PORT","SESSION_HORAS","RESPALDOS","RESPALDOS_DIAS","RESPALDOS_EXTERNO","SITIO_ID")) {
          Anotar ("  $nombre = " + $valor)
        } else {
          Anotar ("  $nombre -> presente (valor oculto, " + $valor.Length + " caracteres)")
        }
      }
    }
    if ($hayBom) {
      Anotar "  ATENCION: el archivo empieza con una marca invisible (BOM)."
      Anotar "  Eso rompe la lectura de la primera linea al arrancar."
    } else {
      Anotar "  Sin marca invisible al inicio: correcto."
    }
    try {
      $acl = Get-Acl $entorno
      Anotar ("  Quien puede leerlo: " + (($acl.Access | ForEach-Object { $_.IdentityReference }) -join ", "))
    } catch { }
  }
}

# --- 4. El sistema responde ----------------------------------------------

Titulo "4. El sistema responde"
$puerto = "3000"
$entorno = Join-Path $Destino "entorno"
if (Test-Path $entorno) {
  foreach ($linea in Get-Content $entorno) {
    if ($linea -match '^\s*PORT=(.*)$') { $puerto = $Matches[1].Trim() }
  }
}
Anotar ("Puerto configurado: " + $puerto)
foreach ($ruta in @("/api/salud","/api/red/estado")) {
  try {
    $r = Invoke-WebRequest -Uri ("http://localhost:" + $puerto + $ruta) -TimeoutSec 15 -UseBasicParsing
    Anotar ($ruta.PadRight(22) + "HTTP " + $r.StatusCode + "  " + $r.Content)
  } catch {
    Anotar ($ruta.PadRight(22) + "SIN RESPUESTA: " + $_.Exception.Message)
  }
}

# --- 5. Tareas programadas ----------------------------------------------

Titulo "5. Tareas programadas (arranque y respaldo)"
foreach ($nombre in @("SistemaEscolar","SistemaEscolarRespaldo")) {
  try {
    $t = Get-ScheduledTask -TaskName $nombre -ErrorAction Stop
    $info = Get-ScheduledTaskInfo -TaskName $nombre -ErrorAction SilentlyContinue
    Anotar ($nombre + ":")
    Anotar ("   estado:          " + $t.State)
    Anotar ("   corre como:      " + $t.Principal.UserId + " (" + $t.Principal.RunLevel + ")")
    if ($info) {
      Anotar ("   ultima corrida:  " + $info.LastRunTime)
      Anotar ("   resultado:       " + $info.LastTaskResult + $(if ($info.LastTaskResult -eq 0) { "  (bien)" } else { "  <-- DISTINTO DE CERO: algo fallo" }))
      Anotar ("   proxima:         " + $info.NextRunTime)
    }
  } catch {
    Anotar ($nombre + ": NO EXISTE (el instalador no la registro)")
  }
}

# --- 6. Firewall y red ---------------------------------------------------

Titulo "6. Firewall y direccion de red"
try {
  $regla = Get-NetFirewallRule -DisplayName "Sistema escolar" -ErrorAction Stop
  Anotar ("Regla de firewall: existe, " + $regla.Enabled + ", direccion " + $regla.Direction + ", accion " + $regla.Action)
  try {
    $p = $regla | Get-NetFirewallPortFilter
    Anotar ("   puerto: " + $p.LocalPort + "/" + $p.Protocol)
  } catch { }
} catch {
  Anotar "Regla de firewall 'Sistema escolar': NO EXISTE"
}
try {
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object { $_.IPAddress -notlike "127.*" } |
    ForEach-Object { Anotar ("Direccion de red: " + $_.IPAddress + "/" + $_.PrefixLength + " en " + $_.InterfaceAlias) }
} catch { Anotar "No se pudieron leer las direcciones de red." }

# --- 7. Respaldos --------------------------------------------------------

Titulo "7. Respaldos"
$carpetaResp = Join-Path $Destino "respaldos"
if (Test-Path $entorno) {
  foreach ($linea in Get-Content $entorno) {
    if ($linea -match '^\s*RESPALDOS=(.*)$') { $carpetaResp = $Matches[1].Trim() }
  }
}
Anotar ("Carpeta: " + $carpetaResp)
if (Test-Path $carpetaResp) {
  $copias = Get-ChildItem (Join-Path $carpetaResp "*.dump") -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending
  if ($copias) {
    Anotar ("Hay " + $copias.Count + " respaldo(s). Los mas recientes:")
    $copias | Select-Object -First 5 | ForEach-Object {
      Anotar ("   {0:yyyy-MM-dd HH:mm}  {1,8:N2} MB  {2}" -f $_.LastWriteTime, ($_.Length / 1MB), $_.Name)
    }
  } else {
    Anotar "No hay ningun respaldo todavia."
  }
} else {
  Anotar "La carpeta de respaldos no existe todavia."
}

# Base donde el respaldo se prueba a si mismo.
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  $psql = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
}
if ($psql -and (Test-Path $entorno)) {
  $cadena = ""
  foreach ($linea in Get-Content $entorno) {
    if ($linea -match '^\s*DATABASE_URL=(.*)$') { $cadena = $Matches[1].Trim() }
  }
  if ($cadena) {
    try {
      $u = [Uri]$cadena
      # Los datos se sacan a variables propias antes de usarlos como
      # argumentos. Escribir --host=$u.Host no funciona: PowerShell expande
      # $u y le pega ".Host" como texto, y psql recibe una direccion absurda.
      $srv = $u.Host
      $prt = if ($u.Port -gt 0) { $u.Port } else { 5432 }
      $env:PGPASSWORD = [Uri]::UnescapeDataString($u.UserInfo.Split(':')[1])
      $usr = [Uri]::UnescapeDataString($u.UserInfo.Split(':')[0])
      $bd = $u.AbsolutePath.TrimStart('/')
      $ruta = if ($psql.Source) { $psql.Source } else { $psql.FullName }
      $verif = "${bd}_verificacion"
      & $ruta -tAc "SELECT 1" --host=$srv --port=$prt --username=$usr $verif 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) {
        Anotar ("Base de verificacion '" + $verif + "': existe (el respaldo puede probarse solo)")
      } else {
        Anotar ("Base de verificacion '" + $verif + "': NO EXISTE o no se alcanza.")
        Anotar "   Sin ella el respaldo no se puede verificar y termina con error."
      }
      $cuenta = (& $ruta -tAc 'SELECT count(*) FROM "Alumno"' --host=$srv --port=$prt --username=$usr $bd 2>$null | Out-String).Trim()
      if ($LASTEXITCODE -eq 0) { Anotar ("La aplicacion alcanza la base: si, " + $cuenta + " alumno(s)") }
      else { Anotar "La aplicacion alcanza la base: NO (revisa usuario y permisos)" }
      $env:PGPASSWORD = ""
    } catch {
      Anotar ("No se pudo revisar la base: " + $_.Exception.Message)
    }
  }
}

# --- 8. Registro del arranque -------------------------------------------

Titulo "8. Ultimas lineas del registro"
$registro = Join-Path $Destino "registro.txt"
if (Test-Path $registro) {
  Anotar ("De " + $registro + ":")
  Get-Content $registro -Tail 40 | ForEach-Object { Anotar ("   " + $_) }
} else {
  Anotar "No hay registro.txt (el sistema no ha arrancado nunca desde la tarea)."
}

Titulo "FIN"

$lineas | Set-Content -Path $Salida -Encoding UTF8

Write-Host ""
Write-Host "===================================================================" -ForegroundColor Green
Write-Host " Listo. El archivo a mandar es:" -ForegroundColor Green
Write-Host ""
Write-Host "     $Salida"
Write-Host ""
Write-Host " Abrelo antes de mandarlo si quieres revisar que no lleve nada"
Write-Host " que no quieras compartir. No incluye contrasenas."
Write-Host "===================================================================" -ForegroundColor Green
