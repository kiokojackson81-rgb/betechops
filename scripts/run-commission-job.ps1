#!/usr/bin/env pwsh
Write-Output "Running one-off commissionCalcJob via pnpm dlx ts-node"

# Ensure DATABASE_URL is present in the environment
if (-not $env:DATABASE_URL) {
  Write-Error "DATABASE_URL not set in environment. Export it before running this script."
  exit 2
}

$script = "import('../src/lib/jobs/syncJobs').then(m=>m.commissionCalcJob()).then(r=>{console.log(JSON.stringify(r,null,2));process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})"
Write-Output "Executing ts-node..."
pnpm dlx ts-node -e $script
