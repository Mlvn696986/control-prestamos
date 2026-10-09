@echo off
setlocal
cd /d "%~dp0"
set "ERMIF_NODE=%~dp0.tools\node-v24.21.0-win-x64"
if exist "%ERMIF_NODE%\node.exe" set "PATH=%ERMIF_NODE%;%PATH%"
call npm.cmd run dev
if errorlevel 1 pause
