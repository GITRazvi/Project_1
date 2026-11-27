# Requires PowerShell 7 and a running production Compose database.
param(
  [string]$OutputDirectory = 'backups',
  [string]$ProjectName = 'cloud-notes-production'
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repo '.env.production'
$composeFile = Join-Path $repo 'compose.production.yaml'
if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) { throw 'Missing .env.production.' }
$null = New-Item -ItemType Directory -Path $OutputDirectory -Force
$file = Join-Path (Resolve-Path -LiteralPath $OutputDirectory).Path ("cloud-notes-{0}-{1}.dump" -f (Get-Date -Format 'yyyyMMdd-HHmmss'), [guid]::NewGuid().ToString('N').Substring(0, 8))
$info = [System.Diagnostics.ProcessStartInfo]::new('docker')
$info.UseShellExecute = $false
$info.RedirectStandardOutput = $true
@('compose', '-p', $ProjectName, '--env-file', $envFile, '-f', $composeFile, 'exec', '-T', 'db', 'sh', '-c', 'exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"') | ForEach-Object { $info.ArgumentList.Add($_) }
$process = [System.Diagnostics.Process]::Start($info)
$output = [System.IO.File]::Open($file, [System.IO.FileMode]::CreateNew)
try { $process.StandardOutput.BaseStream.CopyTo($output) } finally { $output.Dispose() }
$process.WaitForExit()
if ($process.ExitCode -ne 0) { throw "Backup failed; incomplete file remains at $file. Do not use it." }
Write-Output "Backup created: $file"
Write-Output 'Store a protected copy off this PC. Backups contain account and note data.'
