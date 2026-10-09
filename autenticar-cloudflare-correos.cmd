@echo off
setlocal
cd /d "%~dp0"
title ERMIF - Acceso oficial de Cloudflare para correos
echo Completa la autorizacion en la pagina oficial de Cloudflare.
echo No compartas contrasenas ni codigos por el chat.
"%~dp0.tools\node-v24.21.0-win-x64\node.exe" "%~dp0node_modules\wrangler\bin\wrangler.js" login --scopes account:read user:read workers_scripts:write workers_routes:write workers_tail:read zone:read queues:write email_sending:write email_routing:write
pause
