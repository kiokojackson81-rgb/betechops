const { execSync } = require("node:child_process");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function runWithEnv(cmd, envOverrides) {
  execSync(cmd, { stdio: "inherit", env: { ...process.env, ...envOverrides } });
}

function getErrorText(error) {
  const parts = [];
  if (error?.stdout) parts.push(String(error.stdout));
  if (error?.stderr) parts.push(String(error.stderr));
  if (error?.message) parts.push(String(error.message));
  return parts.join("\n");
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
  const directUrl =
    (process.env.DIRECT_URL || "").trim() ||
    (process.env.DATABASE_URL_UNPOOLED || "").trim() ||
    (process.env.POSTGRES_URL_NON_POOLING || "").trim() ||
    (process.env.DATABASE_URL_NON_POOLING || "").trim();
  const databaseUrl = (process.env.DATABASE_URL || "").trim();
  const effectiveDirectUrl = directUrl || databaseUrl;
  const envOverrides = effectiveDirectUrl
    ? {
        DATABASE_URL: effectiveDirectUrl,
        DIRECT_URL: effectiveDirectUrl,
      }
    : {};

  if (!directUrl) {
    console.warn("[vercel-build] No direct non-pooling database URL is set. Skipping prisma migrate deploy to avoid advisory-lock failures on pooled connections. Set DIRECT_URL, DATABASE_URL_UNPOOLED, or POSTGRES_URL_NON_POOLING and run migrations separately.");
    return;
  }

  try {
    runWithEnv("npx prisma migrate deploy", envOverrides);
    return;
  } catch (error) {
    console.warn("[vercel-build] prisma migrate deploy failed on first attempt; trying migrate resolve for known failed migrations");
  }

  resolveKnownRolledBackMigrations(envOverrides);
  try {
    runWithEnv("npx prisma migrate deploy", envOverrides);
  } catch (error) {
    const details = getErrorText(error);
    if (details.includes("P1002") || details.includes("pg_advisory_lock")) {
      console.warn("[vercel-build] prisma migrate deploy hit advisory-lock timeout. Continuing build so deployment is not blocked. Re-run migrations later using DIRECT_URL.");
      return;
    }
    throw error;
  }
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
