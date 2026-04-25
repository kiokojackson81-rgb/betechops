const { execSync } = require("node:child_process");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function shouldRunMigrations() {
  return process.env.VERCEL_RUN_MIGRATIONS === "1";
}

try {
  if (shouldRunMigrations()) {
    console.log("[vercel-build] VERCEL_RUN_MIGRATIONS=1: running prisma migrate deploy");
    run("npx prisma migrate deploy");
  } else {
    console.log("[vercel-build] skipping prisma migrate deploy");
  }

  console.log("[vercel-build] running next build");
  run("next build --turbopack");
} catch (err) {
  console.error("[vercel-build] failed", err);
  process.exit(1);
}
