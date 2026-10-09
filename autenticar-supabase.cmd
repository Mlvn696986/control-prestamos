@echo off
setlocal
cd /d "%~dp0"
set "ERMIF_NODE=%~dp0.tools\node-v24.21.0-win-x64"
if exist "%ERMIF_NODE%\node.exe" set "PATH=%ERMIF_NODE%;%PATH%"
echo Acceso oficial de Supabase para ERMIF.
echo Pulsa Enter si se solicita y completa el acceso en el navegador.
echo No compartas contrasenas, tokens ni codigos por el chat.
if exist "%~dp0.tools\supabase-auth-2.120.0\supabase.exe" (
  "%~dp0.tools\supabase-auth-2.120.0\supabase.exe" login --agent no --output-format text
) else (
  call npx.cmd --no-install supabase login --agent no --output-format text
)
pause
