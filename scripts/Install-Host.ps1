#Requires -Version 5.1
[CmdletBinding(DefaultParameterSetName = 'Install')]
param(
    [Parameter(Mandatory, ParameterSetName = 'Install')]
    [ValidatePattern('\A[a-p]{32}\z')]
    [string] $ExtensionId,

    [Parameter(Mandatory, ParameterSetName = 'Uninstall')]
    [switch] $Uninstall
)

$ErrorActionPreference = 'Stop'
$hostName = 'io.github.quijotevitruvio.multitiktok'
$registryPath = "Software\Google\Chrome\NativeMessagingHosts\$hostName"

if ($Uninstall) {
    [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKey($registryPath, $false)
    Write-Output 'Componente desvinculado de Chrome. Los perfiles y sus sesiones siguen en Chrome.'
    return
}

$packageExe = Join-Path $PSScriptRoot 'host/MultiTikTok.Host.exe'
$sourceExe = Join-Path (Split-Path -Parent $PSScriptRoot) 'dist/host/MultiTikTok.Host.exe'
$hostExe = @($packageExe, $sourceExe) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $hostExe) {
    throw 'Falta el ejecutable. Extrae el paquete completo o ejecuta scripts/Build.ps1 desde el código fuente.'
}

$installDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MultiTikTok'
New-Item -ItemType Directory -Path $installDir -Force | Out-Null
$destination = Join-Path $installDir 'MultiTikTok.Host.exe'
Copy-Item -LiteralPath $hostExe -Destination $destination -Force
$manifestPath = Join-Path $installDir 'native-host.json'
$manifest = @{
    name = $hostName
    description = 'Abre perfiles de Chrome para MultiTikTok'
    path = $destination
    type = 'stdio'
    allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Compress
[IO.File]::WriteAllText($manifestPath, $manifest)

$key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($registryPath)
try {
    $key.SetValue('', $manifestPath, [Microsoft.Win32.RegistryValueKind]::String)
}
finally {
    $key.Dispose()
}
Write-Output 'Componente instalado para tu usuario. Abre MultiTikTok y pulsa Actualizar.'
