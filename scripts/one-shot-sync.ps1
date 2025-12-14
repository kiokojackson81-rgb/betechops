param(
  [string]$BaseUrl = "https://ops.betech.co.ke",
  [string]$AdminToken,
  [int]$LookbackDays = 30,
  [int]$PollIntervalSeconds = 5,
  [int]$TimeoutSeconds = 300,
  [switch]$DoVercelDeploy
)

if (-not $AdminToken) {
  Write-Error "Missing -AdminToken. Provide a valid admin bearer token. Example: -AdminToken '<TOKEN>'"
  exit 2
}

function PostJson($path) {
  $uri = "$BaseUrl$path"
  return Invoke-RestMethod -Method Post -Uri $uri -Headers @{ Authorization = "Bearer $AdminToken" } -ErrorAction Stop
}
function GetJson($path) {
  $uri = "$BaseUrl$path"
  return Invoke-RestMethod -Method Get -Uri $uri -Headers @{ Authorization = "Bearer $AdminToken" } -ErrorAction Stop
}

# Optional: run a vercel prod deploy if requested and vercel CLI exists
if ($DoVercelDeploy) {
  if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Error "vercel CLI not found on PATH. Install it or run deploy manually."
    exit 3
  }
  Write-Host "Running 'vercel --prod' to deploy..."
  vercel --prod
}

Write-Host "Triggering incremental sync for $LookbackDays days..."
try {
  $inc = PostJson "/api/jumia/jobs/sync-incremental?lookbackDays=$LookbackDays"
  $inc | ConvertTo-Json -Depth 10 | Out-File sync-incremental-response.json -Encoding utf8
  Write-Host "sync-incremental response saved to sync-incremental-response.json"
} catch {
  Write-Warning "sync-incremental failed: $_"
}

Write-Host "Triggering pending snapshot sync..."
try {
  $snap = PostJson "/api/jumia/sync-pending"
  $snap | ConvertTo-Json -Depth 10 | Out-File sync-pending-response.json -Encoding utf8
  Write-Host "sync-pending response saved to sync-pending-response.json"
} catch {
  Write-Warning "sync-pending failed: $_"
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
Write-Host "Polling KPI endpoints until fresh or timeout ($TimeoutSeconds seconds)"
while ((Get-Date) -lt $deadline) {
  try {
    $pending = GetJson "/api/metrics/pending-diff?days=$LookbackDays"
    $kpis = GetJson "/api/metrics/kpis?windowDays=$LookbackDays"

    $pending | ConvertTo-Json -Depth 12 | Out-File pending-diff.json -Encoding utf8
    $kpis | ConvertTo-Json -Depth 12 | Out-File kpis.json -Encoding utf8

    $dbPending = $pending.db?.pending
    $vendorPending = $pending.vendor?.pending
    $vendorSource = $pending.vendor?.source

    Write-Host "[Poll $(Get-Date -Format s)] dbPending=$dbPending vendorPending=$vendorPending vendorSource=$vendorSource"

    # Condition 1: counts match
    if (($dbPending -ne $null) -and ($vendorPending -ne $null) -and ($dbPending -eq $vendorPending)) {
      Write-Host "DB and vendor pending counts match — finished."
      break
    }

    # Condition 2: vendor snapshot exists and covers the requested window
    if ($vendorSource -and $vendorSource -eq 'snapshot' -and $pending.snapshot) {
      $windowDays = $pending.snapshot.windowDays
      $totalOrders = $pending.snapshot.totalOrders
      Write-Host "Snapshot present: windowDays=$windowDays totalOrders=$totalOrders"
      if ($windowDays -ge $LookbackDays) {
        Write-Host "Snapshot covers requested window — finished."
        break
      }
    }

  } catch {
    Write-Warning "Poll error: $_"
  }

  Start-Sleep -Seconds $PollIntervalSeconds
}

Write-Host "Done. Saved files: sync-incremental-response.json, sync-pending-response.json, pending-diff.json, kpis.json"
Write-Host "Open those files or paste their contents here if you want me to analyze them further."