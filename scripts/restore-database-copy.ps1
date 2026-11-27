# Restores only into a newly created database; never overwrites an existing database.
param(
  [Parameter(Mandatory)] [string]$BackupFile,
  [Parameter(Mandatory)] [ValidatePattern('^[a-z][a-z0-9_]{0,48}$')] [string]$NewDatabase,
  [string]$ProjectName = 'cloud-notes-production'
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repo '.env.production'
$composeFile = Join-Path $repo 'compose.production.yaml'
$archive = (Resolve-Path -LiteralPath $BackupFile).Path
$composeArgs = @('compose', '-p', $ProjectName, '--env-file', $envFile, '-f', $composeFile, 'exec', '-T', 'db')

function Invoke-ArchiveCommand([string[]]$extraArgs) {
  $info = [System.Diagnostics.ProcessStartInfo]::new('docker')
  $info.UseShellExecute = $false
  $info.RedirectStandardInput = $true
  foreach ($arg in ($composeArgs + $extraArgs)) { $info.ArgumentList.Add($arg) }
  $process = [System.Diagnostics.Process]::Start($info)
  $inputFile = [System.IO.File]::OpenRead($archive)
  try { $inputFile.CopyTo($process.StandardInput.BaseStream) } finally { $inputFile.Dispose(); $process.StandardInput.Close() }
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw "Archive command failed with exit code $($process.ExitCode)." }
}

Invoke-ArchiveCommand @('pg_restore', '--list')
& docker @composeArgs sh -c 'exec createdb -U "$POSTGRES_USER" "$1"' sh $NewDatabase
if ($LASTEXITCODE -ne 0) { throw 'Could not create the new database. An existing database is never overwritten.' }
try {
  Invoke-ArchiveCommand @('sh', '-c', 'exec pg_restore --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d "$1"', 'sh', $NewDatabase)
  Write-Output "Restored into new database: $NewDatabase. The running app was not switched."
} catch {
  Write-Error "Restore failed. The new database '$NewDatabase' may be incomplete; the running app was not changed. $_"
  throw
}
