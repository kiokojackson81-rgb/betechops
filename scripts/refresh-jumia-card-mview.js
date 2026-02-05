#!/usr/bin/env node
try { require('dotenv/config'); } catch {}
const { spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

function runQuickSync(lookbackDays) {
  console.log('[refresh-mview] Running quick Jumia sync (dist runner)...');
  const args = ['scripts/run-jumia-one-shot-dist.js'];
  if (lookbackDays) args.push(`--lookbackDays=${lookbackDays}`);
  const res = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env, shell: false });
  if (res.error) {
    console.error('[refresh-mview] sync spawn error:', res.error && res.error.message ? res.error.message : res.error);
    return false;
  }
  if (res.status !== 0) {
    console.error('[refresh-mview] sync exited with code', res.status);
    return false;
  }
  return true;
}

async function ensureCacheTable(prisma) {
  const sqlFile = path.join(__dirname, 'sql', 'create_jumia_card_cache.sql');
  if (!fs.existsSync(sqlFile)) return;
  const sql = fs.readFileSync(sqlFile, 'utf8');
  try {
    // Prisma does not accept multiple SQL commands in one prepared statement,
    // so split and execute statements individually.
    const stmts = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
      await prisma.$executeRawUnsafe(stmt);
    }
    console.log('[refresh-mview] ensured jumia_card_cache exists');
  } catch (err) {
    console.warn('[refresh-mview] ensure cache table warning:', err && err.message ? err.message : err);
  }
}

async function computeAndUpsert(weekStart) {
  const prisma = new PrismaClient();
  try {
    await ensureCacheTable(prisma);

    // Normalize the provided weekStart into the canonical Nairobi-week UTC
    // weekStart (Monday 00:00 Nairobi expressed in UTC). Accepts either
    // a plain date (YYYY-MM-DD) or an ISO string; falls back to the
    // literal midnight UTC if parsing fails.
    function parseDateOnlyUtc(value) {
      if (!value) return null;
      const datePart = String(value).slice(0, 10);
      const parts = datePart.split('-').map((v) => Number(v));
      if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
      const [year, month, day] = parts;
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    }

    const NAIROBI_TZ = 'Africa/Nairobi';
    const NAIROBI_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
      timeZone: NAIROBI_TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    function extractNairobiDateParts(dateUtc) {
      const parts = NAIROBI_DATE_FORMATTER.formatToParts(dateUtc);
      const yearPart = parts.find((p) => p.type === 'year')?.value ?? '';
      const monthPart = parts.find((p) => p.type === 'month')?.value ?? '';
      const dayPart = parts.find((p) => p.type === 'day')?.value ?? '';
      return {
        year: Number(yearPart),
        month: Number(monthPart),
        day: Number(dayPart),
      };
    }

    function canonicalNairobiWeekStartUtc(dateUtc) {
      const { year, month, day } = extractNairobiDateParts(dateUtc);
      if ([year, month, day].some((v) => Number.isNaN(v))) {
        return new Date(Date.UTC(dateUtc.getUTCFullYear(), dateUtc.getUTCMonth(), dateUtc.getUTCDate(), 0, 0, 0, 0));
      }
      const nairobiDateUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const currentDay = nairobiDateUtc.getUTCDay();
      const deltaToMonday = (currentDay + 6) % 7;
      nairobiDateUtc.setUTCDate(nairobiDateUtc.getUTCDate() - deltaToMonday);
      return nairobiDateUtc;
    }

    let weekDate = null;
    // Try to parse ISO first
    const parsedIso = new Date(weekStart);
    if (!Number.isNaN(parsedIso.getTime())) {
      weekDate = canonicalNairobiWeekStartUtc(parsedIso);
    } else {
      const parsedDateOnly = parseDateOnlyUtc(weekStart);
      if (parsedDateOnly) weekDate = canonicalNairobiWeekStartUtc(parsedDateOnly);
    }
    if (!weekDate) weekDate = new Date(new Date(weekStart + 'T00:00:00Z'));
    console.log('[refresh-mview] computing PS statement sums for', weekStart, '-> canonical weekStart UTC', weekDate.toISOString());

    // Allow a small tolerance window when matching weekStart because stored
    // rows may use a UTC timestamp that corresponds to the Nairobi local
    // midnight (which can differ by a few hours). Match any row whose
    // `weekStart` falls within +/- 24 hours of the canonical value.
    const startTolerance = new Date(weekDate.getTime() - 24 * 3600 * 1000);
    const endTolerance = new Date(weekDate.getTime() + 24 * 3600 * 1000);
    const rows = await prisma.marketplacePayoutWeek.findMany({ where: { weekStart: { gte: startTolerance, lt: endTolerance } } });

    const map = new Map();
    for (const r of rows) {
      const stmt = r.statementNumber || '';
      if (!stmt.startsWith('PS')) continue;
      const shop = (r.rawPayload && r.rawPayload.shopSid) || null;
      const cur = map.get(shop) || 0;
      map.set(shop, cur + Number(r.payoutAmount || 0));
    }

    if (map.size === 0) {
      console.log('[refresh-mview] no PS statements found for', weekStart);
    }

    for (const [shop, total] of map.entries()) {
      try {
        await prisma.$executeRawUnsafe(
          'INSERT INTO public.jumia_card_cache(week_start, shop_sid, total, updated_at) VALUES ($1, $2::uuid, $3, now()) ON CONFLICT (week_start, shop_sid) DO UPDATE SET total = EXCLUDED.total, updated_at = now()',
          weekDate,
          shop,
          total
        );
        console.log(`[refresh-mview] upserted week=${weekStart} shop=${shop} total=${Number(total).toFixed(2)}`);
      } catch (err) {
        console.error('[refresh-mview] upsert failed for', shop, err && err.message ? err.message : err);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

(async function main() {
  try {
    const wkArg = process.argv.find(a => a.startsWith('--weekStart='));
    const lookbackArg = process.argv.find(a => a.startsWith('--lookbackDays='));
    const weekStart = wkArg ? wkArg.split('=')[1] : new Date().toISOString().slice(0,10);
    const lookbackDays = lookbackArg ? Number(lookbackArg.split('=')[1]) : undefined;

    const ok = runQuickSync(lookbackDays);
    if (!ok) {
      console.warn('[refresh-mview] quick sync failed — continuing to compute/upsert from DB');
    }

    await computeAndUpsert(weekStart);
    console.log('[refresh-mview] Done');
    process.exit(0);
  } catch (err) {
    console.error('[refresh-mview] error:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
