<#
PowerShell wrapper to run commission recalculation safely.
Usage: Open PowerShell in repo root and run:
  pwsh ./scripts/run-commission-full.ps1

This script will:
 - verify required tooling and env vars
 - attempt a PostgreSQL dump (if pg_dump is available)
 - run the commission recalculation runner `run-commission-calc.cjs`
 - run post-checks (counts + sample ledger rows)

Be careful: the script assumes `node` is installed and the repo's `node_modules` are present.
#>

param(
  [switch]$Yes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-OK($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err($m){ Write-Host "[ERR] $m" -ForegroundColor Red }

Write-Host "Running commission recalculation wrapper" -ForegroundColor Cyan

# 1) Prechecks
Write-Host "\n== Prechecks =="
# check Node
if (!(Get-Command node -ErrorAction SilentlyContinue)) { Write-Err "node not found in PATH. Install Node.js and retry."; exit 2 }
else { Write-OK "node found: $(node -v)" }
# check pnpm or npm optional
if (Get-Command pnpm -ErrorAction SilentlyContinue) { Write-OK "pnpm found" } else { Write-Warn "pnpm not found; script can still run using node/npm if dependencies are present." }

# check DATABASE_URL
if (-not $env:DATABASE_URL) {
  Write-Err "DATABASE_URL environment variable is not set in this shell. Set it before running this script and re-run.";
  exit 3
}
else { Write-OK "DATABASE_URL present (hidden)" }

# check pg_dump availability
$pgdump = Get-Command pg_dump -ErrorAction SilentlyContinue
$canPgDump = $false
if ($pgdump) { Write-OK "pg_dump available at $($pgdump.Path)"; $canPgDump = $true } else { Write-Warn "pg_dump not available. DB dump step will be skipped. Prefer provider snapshot for production." }

# prompt to continue (safety)
Write-Host "\nAbout to run database dump (if available) and commission job. This will modify commission ledger records." -ForegroundColor Yellow
if (-not $Yes) {
  $confirm = Read-Host "Type YES to continue"
  if ($confirm -ne 'YES') { Write-Err "Aborting. Type YES to run."; exit 1 }
} else {
  Write-Warn "Auto-confirm enabled via -Yes"
}

# 2) DB dump (if possible)
$dumpFile = $null
if ($canPgDump) {
  try {
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    $dumpFile = Join-Path -Path "." -ChildPath "backup-betechops-$ts.dump"
    Write-Host "Creating DB dump to $dumpFile ..."
    # Try to run pg_dump with DATABASE_URL; some pg_dump builds accept URL, others expect separate params.
    & pg_dump $env:DATABASE_URL -Fc -f $dumpFile 2>&1 | ForEach-Object { Write-Host $_ }
    if (Test-Path $dumpFile) { Write-OK "DB dump created: $dumpFile" } else { Write-Warn "pg_dump completed but dump file not found. Check pg_dump output." }
  } catch {
    Write-Warn "pg_dump execution failed: $($_.Exception.Message) . Proceeding without dump as per user request.";
    $dumpFile = $null
  }
} else {
  Write-Warn "Skipping DB dump because pg_dump not available.";
}

# 3) Run commission job
Write-Host "\n== Running commission job ==" -ForegroundColor Cyan
# Prefer running the TypeScript runner with ts-node ESM loader when available.
$runnerTs = Join-Path -Path "." -ChildPath "scripts/run-commission-calc.ts"
$runnerCjs = Join-Path -Path "." -ChildPath "scripts/run-commission-calc.cjs"
$runnerStandalone = Join-Path -Path "." -ChildPath "scripts/run-commission-standalone.cjs"
$logFile = Join-Path -Path "." -ChildPath ("commission-run-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")
Write-Host "Logging runner output to $logFile"

$nodeExe = 'node'
if (Test-Path $runnerStandalone) {
  Write-Host "Found standalone runner; invoking standalone runner first." -ForegroundColor Cyan
  try {
    & $nodeExe $runnerStandalone *> $logFile
    $exitCode = $LASTEXITCODE
  } catch {
    Write-Warn "Failed to start standalone runner: $($_.Exception.Message)"
    $exitCode = 1
  }
} elseif (Test-Path $runnerCjs) {
  Write-Host "Found CommonJS runner; invoking CJS runner." -ForegroundColor Cyan
  try {
    & $nodeExe $runnerCjs *> $logFile
    $exitCode = $LASTEXITCODE
  } catch {
    Write-Warn "Failed to start CJS runner: $($_.Exception.Message)"
    $exitCode = 1
  }
  if ($exitCode -ne 0 -and Test-Path $runnerTs) {
    Write-Host "CJS runner failed; attempting TypeScript runner with ts-node/esm loader." -ForegroundColor Cyan
    $cmd = @('--loader','ts-node/esm','-r','tsconfig-paths/register',$runnerTs)
    try {
      & $nodeExe $cmd *> $logFile
      $exitCode = $LASTEXITCODE
    } catch {
      Write-Warn "Failed to start TS runner: $($_.Exception.Message)"
      $exitCode = 1
    }
  }
} elseif (Test-Path $runnerTs) {
  Write-Host "Only TypeScript runner found; invoking with ts-node/esm loader." -ForegroundColor Cyan
  $cmd = @('--loader','ts-node/esm','-r','tsconfig-paths/register',$runnerTs)
  try {
    & $nodeExe $cmd *> $logFile
    $exitCode = $LASTEXITCODE
  } catch {
    Write-Warn "Failed to start TS runner: $($_.Exception.Message)"
    $exitCode = 1
  }
} else {
  Write-Err "No runner found (none of $runnerStandalone, $runnerTs or $runnerCjs)."; exit 4
}

if ($exitCode -eq 0) { Write-OK "Commission job completed successfully (exit code 0)." } else { Write-Warn "Commission job exited with code $exitCode. Check $logFile for details." }

# print last 200 lines of log
Write-Host "\n--- Last 200 lines of runner log ---" -ForegroundColor Cyan
if (Test-Path $logFile) { Get-Content $logFile -Tail 200 | ForEach-Object { Write-Host $_ } } else { Write-Warn "Log file $logFile not found." }

# 4) Post-checks
Write-Host "\n== Post-checks ==" -ForegroundColor Cyan
Write-Host "Counting approved weeklySale entries and commissionLedger rows..."

# approved weeklySale count
try {
  node -e "const {PrismaClient}=require('@prisma/client');(async()=>{const p=new PrismaClient();const period=require('./src/lib/tradingPeriod').getTradingPeriodFor(new Date());const weekly=await p.weeklySale.count({where:{status:'APPROVED',AND:[{weekEnd:{gte:period.start}},{weekStart:{lte:period.end}}]}});console.log('approvedWeeklySaleCount='+weekly);const ledgerCnt=await p.commissionLedger.count();console.log('commissionLedgerCount='+ledgerCnt);await p.$disconnect();})().catch(e=>{console.error('NODE-ERR',e);process.exit(2)})" 2>&1 | ForEach-Object { Write-Host $_ }
} catch {
  Write-Warn "Post-check: Node check failed: $($_.Exception.Message)";
}

# show last 5 commissionLedger rows (minimal fields)
try {
  node -e "const {PrismaClient}=require('@prisma/client');(async()=>{const p=new PrismaClient();const rows=await p.commissionLedger.findMany({take:5, orderBy:{updatedAt:'desc'}});console.log(JSON.stringify(rows.map(r=>({id:r.id,userId:r.userId,periodStart:r.periodStart,periodEnd:r.periodEnd,grossCommission:r.grossCommission,netCommission:r.netCommission,penalties:r.penalties,detail:r.detail})),null,2));await p.$disconnect();})().catch(e=>{console.error('NODE-ERR',e);process.exit(2)})" 2>&1 | ForEach-Object { Write-Host $_ }
} catch {
  Write-Warn "Post-check: failed to fetch ledger rows: $($_.Exception.Message)";
}

Write-Host "\nCompleted. Review the log and post-check outputs above." -ForegroundColor Cyan
if ($dumpFile) { Write-Host "DB dump created at: $dumpFile" -ForegroundColor Green }
Write-Host "Log file: $logFile" -ForegroundColor Green
