const { PrismaClient } = require('@prisma/client');
const { zonedTimeToUtc } = require('date-fns-tz');
const { addDays } = require('date-fns');
const { spawn } = require('child_process');
const prisma = new PrismaClient();

async function readPendingSnapshot() {
  try {
    const row = await prisma.config.findUnique({ where: { key: 'jumia:pending-live' } });
    if (!row?.json) return null;
    return row.json;
  } catch (e) {
    return null;
  }
}

function isPendingSnapshotFresh(snapshot, maxAgeMs) {
  const referenceIso = snapshot?.completedAt || snapshot?.startedAt;
  if (!referenceIso) return false;
  const referenceMs = Date.parse(referenceIso);
  if (!Number.isFinite(referenceMs)) return false;
  return Date.now() - referenceMs <= maxAgeMs;
}

function runFetchLive(windowDays) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['c:/Projects/betechops/scripts/fetch-live-pending-counts.js', 'c:/Projects/betechops/shops.secrets.json', String(windowDays)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => out += d.toString());
    child.stderr.on('data', (d) => err += d.toString());
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error('fetch script failed: ' + err + '\n' + out));
      // Parse final Live vendor counts from output
      const match = out.match(/Live vendor counts:[\s\S]*$/m);
      if (!match) return resolve({ total: null, raw: out });
      const block = match[0];
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean).slice(1);
      let total = 0;
      const perShop = [];
      for (const line of lines) {
        const m = line.match(/-\s*(.*)\s*\(([^)]+)\):\s*(\d+)/);
        if (m) {
          const name = m[1].trim();
          const id = m[2].trim();
          const count = Number(m[3]);
          total += count;
          perShop.push({ shopId: id, shopName: name, orders: count });
        }
      }
      resolve({ total, perShop, raw: out });
    });
  });
}

async function main() {
  try {
    const now = new Date();
    const DEFAULT_TZ = 'Africa/Nairobi';
    const sevenDaysAgo = zonedTimeToUtc(addDays(now, -7), DEFAULT_TZ);

    // queued (DB 7-day)
    const queued = await prisma.jumiaOrder.count({
      where: {
        status: { in: ['PENDING'] },
        OR: [
          { updatedAtJumia: { gte: sevenDaysAgo } },
          { createdAtJumia: { gte: sevenDaysAgo } },
          { AND: [{ updatedAtJumia: null }, { createdAtJumia: null }, { updatedAt: { gte: sevenDaysAgo } }] },
        ],
      },
    });

    // latestUpdatedMillis
    let latestUpdatedMillis = 0;
    try {
      const latestAgg = await prisma.jumiaOrder.aggregate({ _max: { updatedAt: true, updatedAtJumia: true, createdAtJumia: true }, where: { status: { in: ['PENDING'] } } });
      if (latestAgg && latestAgg._max) {
        latestUpdatedMillis = Math.max(
          latestAgg._max.updatedAt ? new Date(latestAgg._max.updatedAt).getTime() : 0,
          latestAgg._max.updatedAtJumia ? new Date(latestAgg._max.updatedAtJumia).getTime() : 0,
          latestAgg._max.createdAtJumia ? new Date(latestAgg._max.createdAtJumia).getTime() : 0,
        );
      }
    } catch (e) {
      latestUpdatedMillis = 0;
    }

    const staleMinutes = Number(process.env.KPIS_FORCE_LIVE_IF_STALE_MINUTES ?? 3);
    const isStale = latestUpdatedMillis > 0 ? (now.getTime() - latestUpdatedMillis) > staleMinutes * 60 * 1000 : true;

    // fulfillment audits (guard for missing table in some environments)
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let todayPacked = 0;
    let rts = 0;
    try {
      todayPacked = await prisma.fulfillmentAudit.count({ where: { ok: true, createdAt: { gte: startOfDay } } });
      rts = await prisma.fulfillmentAudit.count({ where: { ok: false, createdAt: { gte: startOfDay } } });
    } catch (e) {
      // missing table or perms in this environment; fall back to 0
      todayPacked = 0;
      rts = 0;
    }

    // cross kpis cache
    let cross = { productsAll: 0, pendingAll: 0, approx: true, updatedAt: Date.now() };
    try {
      const row = await prisma.config.findUnique({ where: { key: 'kpis:cross-shops' } });
      if (row?.json) {
        const parsed = row.json;
        if (parsed?.updatedAt && Date.now() - Number(parsed.updatedAt) < 600 * 1000) {
          cross = parsed;
        }
      }
    } catch (e) {}

    // pending snapshot
    const snapshot = await readPendingSnapshot();
    const snapshotMaxAgeMs = Math.max(30_000, Number(process.env.JUMIA_PENDING_SNAPSHOT_MAX_AGE_MS ?? 5 * 60_000));
    let usedSnapshot = false;
    let pendingAllOut = queued;
    let approxFlag = false;
    let pendingSource = 'db';
    let pendingSnapshotWindowDays = undefined;

    const preferVendorWhenDiff = String(process.env.KPIS_PREFER_VENDOR_WHEN_DIFF ?? 'true').toLowerCase() !== 'false';
    const expectedWindowDays = Number(process.env.JUMIA_PENDING_WINDOW_DAYS ?? 7);

    if (snapshot && isPendingSnapshotFresh(snapshot, snapshotMaxAgeMs)) {
      const snapshotWindowDays = Number(snapshot.windowDays ?? 0);
      if (Number.isFinite(snapshotWindowDays) && snapshotWindowDays === expectedWindowDays) {
        const snapshotTotal = Number(snapshot.totalOrders ?? 0);
        if (preferVendorWhenDiff && snapshotTotal !== queued) {
          pendingAllOut = snapshotTotal;
          approxFlag = true;
        } else if (snapshotTotal > pendingAllOut) {
          pendingAllOut = snapshotTotal;
          approxFlag = true;
        }
        if (snapshot.ok === false) approxFlag = true;
        pendingSource = snapshot.ok ? 'snapshot' : 'snapshot-partial';
        usedSnapshot = true;
        pendingSnapshotWindowDays = snapshotWindowDays;
      }
    }

    // If not used snapshot, run live vendor aggregation (via helper script)
    let liveTotal = null;
    if (!usedSnapshot) {
      try {
        const live = await runFetchLive(expectedWindowDays);
        if (live && typeof live.total === 'number') {
          liveTotal = live.total;
          if (live.total !== queued && preferVendorWhenDiff) {
            pendingAllOut = live.total;
            approxFlag = true;
          } else if (live.total > pendingAllOut) {
            pendingAllOut = live.total;
            approxFlag = true;
          }
          pendingSource = 'live';
        }
      } catch (e) {
        // ignore
      }
    }

    const result = {
      queued,
      todayPacked,
      rts,
      cross,
      pendingAll: pendingAllOut,
      approx: approxFlag,
      pendingSource,
      pendingSnapshotWindowDays: pendingSnapshotWindowDays ?? undefined,
      stale: isStale,
      latestPendingUpdatedAt: latestUpdatedMillis || undefined,
      liveTotal,
    };

    console.log('KPI computed result:');
    console.log(JSON.stringify(result, null, 2));

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
