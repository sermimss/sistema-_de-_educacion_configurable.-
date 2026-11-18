@echo off
rem Recupera el acceso del administrador del colegio en esta computadora.
rem Clic derecho > Ejecutar como administrador (el archivo entorno esta protegido).
cd /d "%~dp0"
node scripts\restablecer-admin.mjs %*
echo.
pause
