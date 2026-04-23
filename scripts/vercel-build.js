const { execSync } = require("node:child_process");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function isVercelProduction() {
  return process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";
}

try {
  console.log("[vercel-build] checking repository for unresolved merge markers");
  run("node scripts/precommit-check.js --all");

  if (process.env.VERCEL === "1") {
    console.log(`[vercel-build] vercel (${process.env.VERCEL_ENV ?? "unknown"}): running prisma migrate deploy`);
    run("npx prisma migrate deploy");
  } else if (isVercelProduction()) {
    // Backward compatibility (should not happen): keep this branch in case Vercel flags change.
    console.log("[vercel-build] production deploy: running prisma migrate deploy");
    run("npx prisma migrate deploy");
  } else {
    console.log("[vercel-build] not vercel: skipping prisma migrate deploy");
  }

  console.log("[vercel-build] running next build");
  run("next build --turbopack");
} catch (err) {
  console.error("[vercel-build] failed", err);
  process.exit(1);
}
