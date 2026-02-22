const { execSync } = require("node:child_process");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function isVercelProduction() {
  return process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";
}

try {
  if (isVercelProduction()) {
    console.log("[vercel-build] production deploy: running prisma migrate deploy");
    run("npx prisma migrate deploy");
  } else {
    console.log("[vercel-build] not production: skipping prisma migrate deploy");
  }

  console.log("[vercel-build] running next build");
  run("next build --turbopack");
} catch (err) {
  console.error("[vercel-build] failed", err);
  process.exit(1);
}

