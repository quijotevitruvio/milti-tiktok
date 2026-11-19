#Requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$hostOutput = Join-Path $dist 'host'

dotnet publish (Join-Path $root 'host/MultiTikTok.Host.csproj') -c Release -r win-x64 `
    --self-contained true -p:PublishSingleFile=true -p:DebugType=none -p:DebugSymbols=false -o $hostOutput
if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo compilar el componente de Windows.'
}

Compress-Archive -Path (Join-Path $root 'extension/*') -DestinationPath (Join-Path $dist 'extension.zip') -Force
$package = @(
    (Join-Path $root 'extension')
    $hostOutput
    (Join-Path $PSScriptRoot 'Install-Host.ps1')
    (Join-Path $root 'README.md')
    (Join-Path $root 'PRIVACIDAD.md')
    (Join-Path $root 'LICENSE')
)
Compress-Archive -LiteralPath $package -DestinationPath (Join-Path $dist 'MultiTikTok-Windows-x64.zip') -Force
Write-Output "Paquete creado en $dist"
