# Find files with more than one `from "react"` import line
$files = Get-ChildItem -Recurse -Include *.tsx,*.ts -File
$found = $false
foreach ($f in $files) {
  $matches = Select-String -Path $f.FullName -SimpleMatch 'from "react"'
  if ($matches.Count -gt 1) {
    Write-Output "FILE: $($f.FullName) - Matches: $($matches.Count)"
    foreach ($m in $matches) {
      Write-Output ("  Line:{0}: {1}" -f $m.LineNumber, $m.Line)
    }
    $found = $true
  }
}
if (-not $found) { Write-Output "No files found with multiple 'from \"react\"' imports." }
