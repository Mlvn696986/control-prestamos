@echo off
setlocal
cd /d "%~dp0"
title ERMIF - Respaldo de Supabase sin Docker
:retry
powershell.exe -NoProfile -File "%~dp0scripts\backup-guided.ps1"
if errorlevel 1 goto failed
echo.
echo El asistente termino. Revisa el resultado anterior.
choice /c S /n /m "Pulsa S cuando hayas leido el resultado: "
exit /b 0
:failed
echo.
echo No se completo el respaldo. Revisa el mensaje anterior.
choice /c RS /n /m "Pulsa R para reintentar o S para terminar: "
if errorlevel 2 exit /b 1
if errorlevel 1 goto retry
exit /b 1
