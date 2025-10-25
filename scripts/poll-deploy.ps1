$url = 'https://ops.betech.co.ke/api/debug/jumia?probe=true'
## Extended polling: try longer to allow Vercel to finish rolling the deployment
$max = 40
for ($i=1; $i -le $max; $i++) {
  Write-Host (("Attempt {0} of {1}: GET {2}") -f $i, $max, $url)
  try {
    $resp = curl -sS $url
    $text = $resp
    Write-Host $text
    if ($text -match '"probeResults"' -or $text -match 'deep candidate probe executed') {
      Write-Host "Detected probeResults in response; stopping polling."
      break
    }
  } catch {
    Write-Host "Request failed: $($_.Exception.Message)"
  }
  if ($i -lt $max) {
    Write-Host "Waiting 10s before next attempt..."
    Start-Sleep -Seconds 10
  }
}
Write-Host "Polling finished."