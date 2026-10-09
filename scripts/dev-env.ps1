# Dot-source desde PowerShell: . .\scripts\dev-env.ps1
$ermifRoot = Split-Path -Parent $PSScriptRoot
$ermifNode = Join-Path $ermifRoot '.tools\node-v24.21.0-win-x64'
if (-not (Test-Path -LiteralPath (Join-Path $ermifNode 'node.exe'))) {
    throw 'Instala Node 24 LTS o restaura la herramienta local indicada en DEVELOPMENT.md.'
}
$env:PATH = "$ermifNode;$(Join-Path $ermifRoot 'node_modules\.bin');$env:PATH"
function npm { & (Join-Path $ermifNode 'npm.cmd') @args }
function npx { & (Join-Path $ermifNode 'npx.cmd') @args }
