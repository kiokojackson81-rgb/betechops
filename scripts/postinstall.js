const { spawnSync } = require('child_process');

function run(cmd, args) {
  console.log('> ' + [cmd].concat(args).join(' '));
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(' ')}`);
    process.exit(res.status || 1);
  }
}

function runResult(cmd, args) {
  console.log('> ' + [cmd].concat(args).join(' '));
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  return res.status || 0;
}

function runResultWithEnv(cmd, args, envOverrides) {
  console.log('> ' + [cmd].concat(args).join(' '));
  const env = { ...process.env, ...(envOverrides || {}) };
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env });
  return res.status || 0;
}

function isVercelProduction() {
  return process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryChromiumDownload() {
  try {
    // Attempt to require the Vercel-friendly chromium package and resolve
    // the executable path. This will trigger any on-demand binary fetch.
    const chromium = require('@sparticuz/chromium');
    if (chromium && typeof chromium.executablePath === 'function') {
      console.log('Attempting to resolve chromium executable path (this may download binaries)');
      const p = chromium.executablePath();
      if (p && typeof p.then === 'function') {
        await p;
      }
      console.log('chromium executable path resolved (or attempted)');
    }
  } catch (err) {
    // Non-fatal: log warning but do not fail the overall install.
    console.warn('chromium download/resolve attempted but failed (non-fatal):', err && err.message ? err.message : err);
  }
}

(async function main() {
  try {
    // 0) Ensure production DB is migrated before building on Vercel.
    // Vercel may be configured to run `next build` directly, bypassing scripts/vercel-build.js.
    // Running migrations here ensures the Prisma client and Server Components don't crash on schema drift.
    if (isVercelProduction()) {
      // Prisma migrate should prefer a non-pooler/direct connection (e.g., Neon "direct" URL).
      // If DIRECT_URL is provided, temporarily run migrations against it by overriding DATABASE_URL.
      const directUrl = (process.env.DIRECT_URL || '').trim();
      const envForMigrate = directUrl ? { DATABASE_URL: directUrl } : null;

      let lastCode = 0;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        lastCode = envForMigrate
          ? runResultWithEnv('npx', ['prisma', 'migrate', 'deploy'], envForMigrate)
          : runResult('npx', ['prisma', 'migrate', 'deploy']);

        if (lastCode === 0) break;
        console.warn(`[postinstall] prisma migrate deploy failed (attempt ${attempt}/3)`);

        // If a migration previously failed on the production database, Prisma will refuse to proceed
        // until it is resolved. Auto-resolve the known migration and try again next attempt.
        if (attempt === 1) {
          console.warn('[postinstall] attempting migrate resolve for 20260305_marketplace_email_intelligence');
          if (envForMigrate) {
            runResultWithEnv('npx', ['prisma', 'migrate', 'resolve', '--rolled-back', '20260305_marketplace_email_intelligence'], envForMigrate);
          } else {
            runResult('npx', ['prisma', 'migrate', 'resolve', '--rolled-back', '20260305_marketplace_email_intelligence']);
          }
        }

        await sleep(3000);
      }

      if (lastCode !== 0) {
        // Do not fail the whole Vercel deployment on transient DB lock/timeouts (common with poolers).
        // The app is written to degrade gracefully when the newest tables/columns aren't present.
        console.warn(
          '[postinstall] prisma migrate deploy did not succeed. ' +
            'Set DIRECT_URL to a direct (non-pooler) Postgres connection string to make migrations reliable. ' +
            'Continuing build without blocking deployment.',
        );
      }
    }

    // 1) Generate Prisma client
    run('npm', ['run', 'prisma:generate']);
    // 2) Setup git hooks
    run('npm', ['run', 'setup:hooks']);
    // 3) Try to trigger chromium binary download (non-fatal)
    await tryChromiumDownload();
    console.log('postinstall completed');
  } catch (err) {
    console.error('postinstall failed', err);
    process.exit(1);
  }
})();
