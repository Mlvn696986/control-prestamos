@echo off
setlocal
cd /d "%~dp0"
set "NODE_HOME=%~dp0.tools\node-v24.21.0-win-x64"
if exist "%NODE_HOME%\node.exe" set "PATH=%NODE_HOME%;%PATH%"
echo ERMIF - usa npm run dev para iniciar en http://127.0.0.1:8787
cmd /k
