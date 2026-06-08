const { execSync } = require("node:child_process");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function runWithEnv(cmd, envOverrides) {
  execSync(cmd, { stdio: "inherit", env: { ...process.env, ...envOverrides } });
}

function isVercel() {
  return process.env.VERCEL === "1";
}

function isVercelProduction() {
  return isVercel() && process.env.VERCEL_ENV === "production";
}

function resolveKnownRolledBackMigrations(envOverrides) {
  const knownSafeRollbacks = [
    "20260305_marketplace_email_intelligence",
    "20260605103000_add_firebase_phone_identity",
  ];

  for (const migrationId of knownSafeRollbacks) {
    try {
      console.log(`[vercel-build] attempting migrate resolve for ${migrationId}`);
      runWithEnv(`npx prisma migrate resolve --rolled-back ${migrationId}`, envOverrides);
    } catch (error) {
      console.warn(`[vercel-build] migrate resolve skipped for ${migrationId}`);
    }
  }
}

function runPrismaMigrateDeploy() {
  const directUrl = (process.env.DIRECT_URL || "").trim();
  const databaseUrl = (process.env.DATABASE_URL || "").trim();
  const effectiveDirectUrl = directUrl || databaseUrl;
  const envOverrides = effectiveDirectUrl
    ? {
        DATABASE_URL: effectiveDirectUrl,
        DIRECT_URL: effectiveDirectUrl,
      }
    : {};

  if (!directUrl) {
    console.warn("[vercel-build] DIRECT_URL is not set. Falling back to DATABASE_URL for Prisma CLI. Set DIRECT_URL to a direct non-pooler connection for reliable migrations.");
  }

  try {
    runWithEnv("npx prisma migrate deploy", envOverrides);
    return;
  } catch (error) {
    console.warn("[vercel-build] prisma migrate deploy failed on first attempt; trying migrate resolve for known failed migrations");
  }

  resolveKnownRolledBackMigrations(envOverrides);
  runWithEnv("npx prisma migrate deploy", envOverrides);
}

try {
  console.log("[vercel-build] checking repository for unresolved merge markers");
  run("node scripts/precommit-check.js --all");

  if (isVercelProduction()) {
    console.log(`[vercel-build] vercel (${process.env.VERCEL_ENV ?? "unknown"}): running prisma migrate deploy with direct connection when available`);
    runPrismaMigrateDeploy();
  } else if (isVercel()) {
    console.log(`[vercel-build] vercel (${process.env.VERCEL_ENV ?? "unknown"}): skipping prisma migrate deploy outside production`);
  } else {
    console.log("[vercel-build] not vercel: skipping prisma migrate deploy");
  }

  console.log("[vercel-build] running next build");
  run("next build --turbopack");
} catch (err) {
  console.error("[vercel-build] failed", err);
  process.exit(1);
}
