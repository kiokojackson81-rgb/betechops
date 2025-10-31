[CmdletBinding()]
param(
  [string]$NodePath = "node",
  [string]$ProjectDir = (Resolve-Path "$PSScriptRoot\..\").Path,
  [int]$MaxMinutes = 30
)

# This runs the local library recompute (no HTTP), suitable for running on your server where the repo is deployed.
# Requires env: DATABASE_URL and any JUMIA_* or decryption keys your lib needs.

$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

Push-Location $ProjectDir
try {
  $start = Get-Date
  Write-Host ("[{0}] Starting recomputeAllCounters via library…" -f $start.ToString('s'))
  $env:NODE_OPTIONS = "--max-old-space-size=512"
  $timeoutSec = [int]([Math]::Max(60, $MaxMinutes * 60))

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $NodePath
  $psi.Arguments = "-r ts-node/register -r tsconfig-paths/register scripts/backfill-catalog-counters.js"
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $p = [System.Diagnostics.Process]::Start($psi)

  if (-not $p.WaitForExit($timeoutSec * 1000)) {
    try { $p.Kill() } catch {}
    throw "Timed out after $MaxMinutes minutes"
  }

  $out = $p.StandardOutput.ReadToEnd()
  $err = $p.StandardError.ReadToEnd()
  if ($p.ExitCode -ne 0) {
    Write-Error ("Runner failed with code {0}:`n{1}`nSTDERR:`n{2}" -f $p.ExitCode, $out, $err)
    exit $p.ExitCode
  }
  Write-Output $out
  if ($err) { Write-Warning $err }

  $end = Get-Date
  Write-Host ("[{0}] Done in {1}s" -f $end.ToString('s'), [int](New-TimeSpan -Start $start -End $end).TotalSeconds)
  exit 0
} finally {
  Pop-Location
}
