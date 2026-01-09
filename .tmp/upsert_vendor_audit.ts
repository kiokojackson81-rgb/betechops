import fs from 'fs';
import { PrismaClient } from '@prisma/client';

function canonicalNairobiWeekStartUtc(dateUtc: Date): Date {
  const NAIROBI_OFFSET_MINUTES = 180;
  const nairobiMs = dateUtc.getTime() + NAIROBI_OFFSET_MINUTES * 60_000;
  const nairobi = new Date(nairobiMs);
  const y = nairobi.getUTCFullYear();
  const m = nairobi.getUTCMonth();
  const d = nairobi.getUTCDate();
  const nairobiMidnightUtcMs = Date.UTC(y, m, d, 0, 0, 0) - NAIROBI_OFFSET_MINUTES * 60_000;
  const nairobiLocalMidnight = new Date(nairobiMidnightUtcMs + NAIROBI_OFFSET_MINUTES * 60_000);
  const day = nairobiLocalMidnight.getUTCDay();
  const deltaToMonday = (day + 6) % 7;
  const mondayUtcMs = nairobiMidnightUtcMs - deltaToMonday * 24 * 60 * 60 * 1000;
  return new Date(mondayUtcMs);
}

function parseDateOnlyUtc(value?: string | null): Date | null {
  if (!value) return null;
  const datePart = String(value).slice(0, 10);
  const parts = datePart.split('-').map((v) => Number(v));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

async function main() {
  const path = '.tmp/vendor_live_audit_all_2025-12-21.json';
  if (!fs.existsSync(path)) {
    console.error('audit file not found:', path);
    process.exit(2);
  }
  const raw = fs.readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);
  const prisma = new PrismaClient();
  const report: any = { inserted: [], updated: [], skipped: [] };

  for (const cred of parsed.results || []) {
    const scope = String(cred.scope || '');
    const m = scope.match(/^MARKETPLACE_ACCOUNT:(.+)$/);
    const accountId = m ? m[1] : null;
    if (!accountId) {
      report.skipped.push({ reason: 'no_account_scope', credentialId: cred.credentialId });
      continue;
    }
    for (const s of cred.statements || []) {
      const stmt = String(s.statementNumber || '');
      const payout = Number((s.payout && s.payout.amount) ?? 0);
      const periodStart = s.period?.startDate ? parseDateOnlyUtc(s.period.startDate) : (s.createdAt ? new Date(s.createdAt) : null);
      const weekStart = periodStart ? canonicalNairobiWeekStartUtc(periodStart) : canonicalNairobiWeekStartUtc(new Date());
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

      const existing = await prisma.marketplacePayoutWeek.findFirst({ where: { statementNumber: stmt } });
      const rawPayload = s;
      if (!existing) {
        try {
          const created = await prisma.marketplacePayoutWeek.create({ data: {
            accountId,
            statementNumber: stmt,
            weekStart,
            weekEnd,
            grossSales: (s.subtotal2 ?? payout) as any,
            payoutAmount: payout as any,
            currency: (s.payout?.currency || 'KES'),
            isPaid: !!s.paid,
            rawPayload,
          } });
          report.inserted.push({ statement: stmt, accountId, id: created.id });
        } catch (e: any) {
          report.skipped.push({ statement: stmt, accountId, error: String(e.message || e) });
        }
      } else {
        const existingPayout = Number(existing.payoutAmount ?? 0);
        if (Math.abs(existingPayout - payout) > 0.001) {
          const updated = await prisma.marketplacePayoutWeek.update({ where: { id: existing.id }, data: { payoutAmount: payout as any, grossSales: (s.subtotal2 ?? payout) as any, rawPayload } });
          report.updated.push({ statement: stmt, accountId, id: existing.id });
        } else {
          report.skipped.push({ statement: stmt, accountId, reason: 'already_present_same_amount' });
        }
      }
    }
  }

  fs.writeFileSync('.tmp/upsert_vendor_audit_result.json', JSON.stringify(report, null, 2));
  console.log('Wrote .tmp/upsert_vendor_audit_result.json', JSON.stringify({ inserted: report.inserted.length, updated: report.updated.length, skipped: report.skipped.length }));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
