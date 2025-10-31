[CmdletBinding()]
param(
  [string]$Url,
  [string]$Secret,
  [int]$TimeoutSec = 45,
  [int]$MaxRetries = 3
)

# Allow env var fallbacks to avoid putting secrets on the command line or in the Task definition
if (-not $Url -or $Url.Trim().Length -eq 0) { $Url = $env:CRON_RECOMPUTE_URL }
if (-not $Secret -or $Secret.Trim().Length -eq 0) { $Secret = $env:CRON_SECRET }

if (-not $Url)   { Write-Error "CRON_RECOMPUTE_URL not set and -Url not provided"; exit 2 }
if (-not $Secret){ Write-Error "CRON_SECRET not set and -Secret not provided"; exit 3 }

try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

# Ensure explicit all=true unless caller provided it
if ($Url -notmatch '(\?|&)all=') {
  if ($Url.Contains('?')) { $Url = "$Url&all=true" } else { $Url = "$Url?all=true" }
}

$attempt = 0
$success = $false
$responseBody = $null

while (-not $success -and $attempt -lt $MaxRetries) {
  $attempt++
  try {
    Write-Host ("POST {0} (attempt {1}/{2})" -f $Url, $attempt, $MaxRetries)
    $headers = @{ 'x-cron-secret' = $Secret; 'Accept'='application/json' }
    $resp = Invoke-RestMethod -Method POST -Uri $Url -Headers $headers -TimeoutSec $TimeoutSec -ErrorAction Stop
    $responseBody = $resp | ConvertTo-Json -Depth 6
    $success = $true
  } catch {
    $msg = $_.Exception.Message
    Write-Warning ("Request failed: {0}" -f $msg)
    if ($attempt -lt $MaxRetries) { Start-Sleep -Seconds ([int][Math]::Min(30,[Math]::Pow(2,$attempt-1))) }
  }
}

if (-not $success) {
  Write-Error "All attempts failed."
  exit 1
}

Write-Host "Success:"
Write-Output $responseBody
exit 0
