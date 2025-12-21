<#
Helper script to mark specific migrations as applied and run migrations against a dev database.

Usage:
  PowerShell:
    $env:DATABASE_URL = "postgresql://user:pass@localhost:5432/devdb?schema=public"
    pwsh ./scripts/resolve-and-migrate.ps1

Notes:
- This script runs `npx prisma migrate resolve --applied` for the two modified migrations
  so their changed SQL checksums won't block a subsequent `prisma migrate dev`.
- Use a dev database you can reset. Do NOT run this against a production DB.
- If you prefer to configure a shadow database for migrations, set `SHADOW_DATABASE_URL` in the
  environment or `schema.prisma` datasource `shadowDatabaseUrl`.
#>

param()

function Fail([string]$msg) {
    Write-Error $msg
    exit 1
}

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Fail "npx not found in PATH. Install Node.js and ensure npx is available."
}

$db = $env:DATABASE_URL
if (-not $db) {
    Fail "Please set the environment variable `DATABASE_URL` to a dev Postgres connection string before running this script."
}

Write-Host "Using DATABASE_URL: $($db -replace ':[^:]*@', ':*****@')" -ForegroundColor Yellow

# Migrations to mark applied (folder names)
$migrations = @(
    '20251130045844_add_weekly_thursday_fields',
    '20251202_fix_attendant_enum_legacy_values'
)

foreach ($m in $migrations) {
    Write-Host "Marking migration as applied: $m" -ForegroundColor Cyan
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'npx'
    $psi.Arguments = "prisma migrate resolve --applied `"$m`""
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.Environment['DATABASE_URL'] = $db

    $proc = [System.Diagnostics.Process]::Start($psi)
    $out = $proc.StandardOutput.ReadToEnd()
    $err = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()

    Write-Host $out
    if ($proc.ExitCode -ne 0) {
        Write-Error "Failed to resolve migration $m. Error output:\n$err"
        exit $proc.ExitCode
    }
}

Write-Host "Resolved modified migrations. Now running 'npx prisma migrate dev' to apply remaining migrations." -ForegroundColor Green

# $env:SHADOW_DATABASE_URL may be set by caller if needed
$psi2 = New-Object System.Diagnostics.ProcessStartInfo
$psi2.FileName = 'npx'
$psi2.Arguments = 'prisma migrate dev'
$psi2.RedirectStandardOutput = $true
$psi2.RedirectStandardError = $true
$psi2.UseShellExecute = $false
$psi2.Environment['DATABASE_URL'] = $db
if ($env:SHADOW_DATABASE_URL) { $psi2.Environment['SHADOW_DATABASE_URL'] = $env:SHADOW_DATABASE_URL }

$proc2 = [System.Diagnostics.Process]::Start($psi2)
$out2 = $proc2.StandardOutput.ReadToEnd()
$err2 = $proc2.StandardError.ReadToEnd()
$proc2.WaitForExit()

Write-Host $out2
if ($proc2.ExitCode -ne 0) {
    Write-Error "'prisma migrate dev' failed. Error output:\n$err2"
    exit $proc2.ExitCode
}

Write-Host "Migrations applied successfully." -ForegroundColor Green
