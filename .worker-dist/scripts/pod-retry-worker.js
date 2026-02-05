// Simple PM2-friendly worker that periodically invokes the pod retry scanner.
// This wrapper loads compiled .worker-dist modules (when present) and ticks
// at POD_RETRY_INTERVAL_MS.
try {
  require('dotenv/config');
} catch {}
process.on('unhandledRejection', (r) => {
  console.error('[pod-retry-worker] unhandledRejection', r);
});
process.on('uncaughtException', (err) => {
  console.error('[pod-retry-worker] uncaughtException', err);
});
// Ensure path aliases (@/*) resolve in the compiled CJS bundle by mapping to .worker-dist/src/
try {
  const tsconfigPaths = require('tsconfig-paths');
  const path = require('path');
  tsconfigPaths.register({ baseUrl: path.join(__dirname, '..'), paths: { '@/*': ['src/*'] } });
} catch {}
const INTERVAL_MS = Number(process.env.POD_RETRY_INTERVAL_MS ?? 60000);
const LOG_PREFIX = '[pod-retry-worker]';
let inFlight = false;
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function tick() {
  if (inFlight) {
    console.warn(`${LOG_PREFIX} previous tick still in-flight; skipping`);
    return;
  }
  inFlight = true;
  try {
    // Require the compiled worker function from .worker-dist; when building
    // the project the compiler should emit .worker-dist/src/workers/podRetryWorker.js
    const worker = require('../src/workers/podRetryWorker');
    const run = worker && (worker.default || worker.runPodRetry || worker);
    if (typeof run === 'function') {
      await run();
    } else {
      console.error(`${LOG_PREFIX} cannot locate run function in podRetryWorker`);
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} tick error`, err);
  }
  inFlight = false;
}
(async () => {
  console.log(`${LOG_PREFIX} starting interval=${INTERVAL_MS}ms`);
  await tick();
  while (true) {
    await sleep(INTERVAL_MS);
    await tick();
  }
})();
