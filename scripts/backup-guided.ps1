$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$privateDirectory = $null
$passwordPointer = [IntPtr]::Zero
$priorDbUrl = $env:SUPABASE_DB_URL
$priorPassFile = $env:PGPASSFILE
$securePassword = $null
try {
    Write-Host 'ERMIF - Copia de Supabase sin Docker'
    Write-Host 'Cierra esta ventana si aun no tienes la contrasena de la base de datos.'
    Write-Host 'En Supabase: Connect > Method: Session pooler > Type: URI.'
    Write-Host 'Copia la cadena dejando [YOUR-PASSWORD] tal como aparece.'
    Write-Host 'Este asistente descarga una copia; no ejecuta migraciones ni restauraciones.'
    Write-Host ''
    $node = Join-Path $projectRoot '.tools\node-v24.21.0-win-x64\node.exe'
    if (-not (Test-Path -LiteralPath $node)) { throw 'Falta Node portable. Abre el proyecto original de ERMIF.' }
    & $node (Join-Path $PSScriptRoot 'backup-native.js') --check-folder
    if ($LASTEXITCODE -ne 0) { throw 'La carpeta no esta lista; no hace falta introducir la contrasena.' }
    # Non-secret Session pooler URI confirmed in the owner's successful login.
    $defaultConnection = 'postgresql://postgres.kltozglqvivknbdcnnyj:[YOUR-PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:5432/postgres'
    Write-Host 'Conexion preparada: ERMIF / Session pooler / aws-1-sa-east-1 / puerto 5432'
    $connection = (Read-Host 'Pulsa ENTER para usar ERMIF, o pega otra cadena con [YOUR-PASSWORD]').Trim()
    if ([string]::IsNullOrWhiteSpace($connection)) { $connection = $defaultConnection }
    $parsed = $null
    if (-not [Uri]::TryCreate($connection, [UriKind]::Absolute, [ref]$parsed)) { throw 'Cadena de conexion invalida.' }
    $userinfo = $parsed.UserInfo.Split(':', 2)
    $username = [Uri]::UnescapeDataString($userinfo[0])
    if ($userinfo.Length -gt 1 -and [Uri]::UnescapeDataString($userinfo[1]) -ne '[YOUR-PASSWORD]') { throw 'Pega la cadena con [YOUR-PASSWORD], sin reemplazarlo por tu clave.' }
    $projectRef = 'kltozglqvivknbdcnnyj'
    $validPooler = $parsed.Host -match '^[a-z0-9-]+\.pooler\.supabase\.com$' -and $username -eq "postgres.$projectRef"
    $validDirect = $parsed.Host -eq "db.$projectRef.supabase.co" -and $username -eq 'postgres'
    if ($parsed.Scheme -notin @('postgres', 'postgresql') -or (-not $validPooler -and -not $validDirect) -or $parsed.AbsolutePath -ne '/postgres' -or ($parsed.Port -ne -1 -and $parsed.Port -ne 5432)) { throw 'Selecciona el proyecto ERMIF y Session pooler, puerto 5432.' }
    $securePassword = Read-Host 'Contrasena de la BASE DE DATOS (oculta)' -AsSecureString
    if ($securePassword.Length -eq 0) { throw 'No se introdujo una contrasena.' }
    $privateDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ('ermif-pgpass-' + [Guid]::NewGuid().ToString('N'))
    [System.IO.Directory]::CreateDirectory($privateDirectory) | Out-Null
    $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
    # Apply the same private ACL via .NET; no Security module autoload dependency.
    [System.IO.Directory]::SetAccessControl($privateDirectory, $acl)
    $passFile = Join-Path $privateDirectory 'connection.pgpass'
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    if ($plainPassword -match "[\r\n]") { throw 'La contrasena no puede contener saltos de linea.' }
    $escapedPassword = $plainPassword.Replace('\', '\\').Replace(':', '\:')
    $entry = $parsed.Host + ':5432:postgres:' + $username + ':' + $escapedPassword + [Environment]::NewLine
    [System.IO.File]::WriteAllText($passFile, $entry, (New-Object System.Text.UTF8Encoding($false)))
    $plainPassword = $null
    $escapedPassword = $null
    $entry = $null
    $env:PGPASSFILE = $passFile
    $env:SUPABASE_DB_URL = $connection
    & $node (Join-Path $PSScriptRoot 'backup-native.js')
    if ($LASTEXITCODE -ne 0) { throw 'No se genero una copia completa. Revisa el mensaje anterior.' }
} catch {
    Write-Host ('No se completo el respaldo: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally {
    $env:SUPABASE_DB_URL = $priorDbUrl
    $env:PGPASSFILE = $priorPassFile
    if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
    if ($securePassword) { $securePassword.Dispose() }
    if ($privateDirectory) {
        # Delete only the generated secret file and its empty directory.
        $cleanupFile = Join-Path $privateDirectory 'connection.pgpass'
        if (Test-Path -LiteralPath $cleanupFile) { Remove-Item -LiteralPath $cleanupFile -Force }
        Remove-Item -LiteralPath $privateDirectory -Force
    }
}
