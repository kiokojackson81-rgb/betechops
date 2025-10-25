$u='https://ops.betech.co.ke/api/debug/jumia-sweep?run=true'
$max=30
for($i=1; $i -le $max; $i++){
  Write-Host (("Attempt {0}: GET {1}") -f $i, $u)
  try { $r = curl -sS $u } catch { $r = '' }
  if ($r -match '"results"' -or $r -match '"ok":true') { Write-Host $r; break }
  else { Write-Host $r }
  Start-Sleep -Seconds 10
}
Write-Host "Finished polling"
