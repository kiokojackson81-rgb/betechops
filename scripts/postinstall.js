const { spawnSync } = require('child_process');

function run(cmd, args) {
  console.log('> ' + [cmd].concat(args).join(' '));
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(' ')}`);
    process.exit(res.status || 1);
  }
}

function isVercelProduction() {
  return process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production';
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
      run('npx', ['prisma', 'migrate', 'deploy']);
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
