param(
  [string]$Name = "jumia-sync",
  [int]$Lines = 80,
  [switch]$Build
)

# Helper: reload a PM2 process and verify worker cadence settings appear in logs
# Usage (PowerShell on the PM2 host):
#   pwsh ./scripts/pm2-reload-and-verify.ps1 -Name jumia-sync -Lines 120

if ($Build) {
  Write-Host "[build] Rebuilding worker bundle..." -ForegroundColor Cyan
  try {
    npm run build:worker --silent | Out-Host
  } catch {
    Write-Warning "[build] Failed to build worker bundle. Continuing to reload existing bundle..."
  }
}

Write-Host "[pm2] Reloading process '$Name' with updated env..." -ForegroundColor Cyan
pm2 reload $Name --update-env | Out-Host

Write-Host "[pm2] Showing last $Lines lines for '$Name'..." -ForegroundColor Cyan
pm2 logs $Name --lines $Lines --nostream | Out-Host

Write-Host "[check] Looking for startup cadence line..." -ForegroundColor Cyan
$expected = 'incrementalLookback(days)='
$log = pm2 logs $Name --lines $Lines --nostream
if ($log -match [regex]::Escape($expected)) {
  Write-Host "[ok] Found cadence line containing: $expected" -ForegroundColor Green
} else {
  Write-Warning "[warn] Did not find cadence line. Ensure the process restarted and that the worker prints its settings on startup."
}

Write-Host "[hint] Expected to see something like:" -ForegroundColor Yellow
Write-Host "  [jumia-sync-worker] starting, interval(ms)= 2000, incrementalEvery(ms)= 2000, incrementalLookback(days)= 3, deepEvery(ms)= 900000, ..." -ForegroundColor DarkGray
