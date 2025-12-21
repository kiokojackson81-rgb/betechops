<#
PowerShell helper to safely deploy Prisma migrations to a production database.

Usage:
  - Ensure you run this where `pnpm`, `pg_dump` (optional), and `psql` (optional) are available.
  - Provide the production connection string via the `DATABASE_URL` environment variable, or the script will prompt.

This script will:
  1. (Optional) Create a compressed pg_dump backup if `pg_dump` is available.
  2. Run `pnpm prisma migrate deploy` against the provided `DATABASE_URL`.
  3. Show `npx prisma migrate status` output.
  4. Optionally run a simple `psql` check to confirm the `adjustmentKind` column exists (if `psql` is available).

WARNING: Always take a backup / snapshot using your managed DB provider if possible before running migrations.
#>

function Prompt-ForDatabaseUrl {
    param()
    Write-Host "Enter the production DATABASE_URL (or press Enter to use existing env var):"
    $input = Read-Host
    if ([string]::IsNullOrWhiteSpace($input)) {
        return $env:DATABASE_URL
    }
    return $input
}

# Get or prompt for DATABASE_URL
if (-not $env:DATABASE_URL) {
    $db = Prompt-ForDatabaseUrl
    if (-not $db) {
        Write-Error "No DATABASE_URL provided. Set the env var or re-run and paste the connection string."
        exit 1
    }
    $env:DATABASE_URL = $db
}

Write-Host "Using DATABASE_URL: (hidden)"

# Verify migration folder exists locally
$migrationFolder = Get-ChildItem -Path "prisma/migrations" -Directory | Where-Object { $_.Name -like "*adjustment_kind*" }
if ($migrationFolder) {
    Write-Host "Found migration folder(s):"
    $migrationFolder | ForEach-Object { Write-Host " - $($_.Name)" }
} else {
    Write-Warning "No migration folder with 'adjustment_kind' found under prisma/migrations. Ensure the migration exists in the repo before running deploy."
}

# Optional backup using pg_dump if available
$pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue)
if ($pgDump) {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmm"
    $backupDir = Join-Path -Path (Get-Location) -ChildPath "backups"
    if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }
    $filename = Join-Path -Path $backupDir -ChildPath "betechops-prod-$timestamp.dump"
    try {
        Write-Host "Running pg_dump to $filename (this may take a while)..."
        & pg_dump --format=custom --file=$filename $env:DATABASE_URL
        if ($LASTEXITCODE -ne 0) { Write-Warning "pg_dump exited with code $LASTEXITCODE" }
        else { Write-Host "Backup completed: $filename" }
    } catch {
        Write-Warning "pg_dump failed: $_";
    }
} else {
    Write-Host "pg_dump not found in PATH — skipping DB backup step. Use your cloud provider to snapshot instead."
}

# Run migrations (pnpm preferred)
Write-Host "Installing dependencies (pnpm) and running prisma migrate deploy..."
$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) {
    Write-Warning "pnpm not found in PATH. Attempting to run via npx instead."
    try {
        npx prisma migrate deploy
    } catch {
        Write-Error "Failed to run migrate deploy. Ensure pnpm or npx is available. Error: $_"
        exit 1
    }
} else {
    try {
        pnpm prisma migrate deploy
    } catch {
        Write-Error "pnpm prisma migrate deploy failed: $_"
        exit 1
    }
}

# Show migration status
Write-Host "Checking migration status..."
try {
    npx prisma migrate status
} catch {
    Write-Warning "Unable to run 'npx prisma migrate status': $_"
}

# Optional quick schema check using psql
$psql = (Get-Command psql -ErrorAction SilentlyContinue)
if ($psql) {
    Write-Host "psql found — checking for 'adjustmentKind' column on receipts table (example)."
    # You may need to adjust table name to the correct one that contains the column
    $tableName = Read-Host -Prompt "Enter table name to check for 'adjustmentKind' (default: receipts)"
    if ([string]::IsNullOrWhiteSpace($tableName)) { $tableName = "receipts" }
    try {
        & psql $env:DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name='${tableName}' AND column_name='adjustmentKind';"
    } catch {
        Write-Warning "psql check failed: $_"
    }
} else {
    Write-Host "psql not found — skipping SQL information_schema check."
}

Write-Host "Migration deploy script finished. If the migration applied successfully, trigger your Vercel redeploy now."