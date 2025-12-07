import { prisma } from '@/lib/prisma';
import { fetchOrdersForShop, fetchPayoutsForShop } from '@/lib/jumia';
import { fetchPayouts as kmFetchPayouts } from '@/lib/connectors/kilimall';
import { decryptJson } from '@/lib/crypto/secure-json';
import { syncOnlineMarketplaceData } from '@/lib/jobs/onlineSync';
import { getTradingPeriodFor } from '@/lib/tradingPeriod';
import { recomputeWeeklySalesCommission } from '@/lib/weeklySales';

export async function syncOrdersJob() {
  const shops = await prisma.shop.findMany();
  const results: Record<string, unknown> = {};
  const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
  for (const s of shops) {
    try {
      if (s.platform === 'JUMIA') {
        if (s.disableAutoSync) {
          results[s.id] = { skipped: true };
          continue;
        }
        const orders = await fetchOrdersForShop(s.id);
        results[s.id] = { count: orders.length };
      } else if (s.platform === 'KILIMALL') {
        // Kilimall shops are tracked manually and never auto-synced.
        results[s.id] = { skipped: true };
      }
    } catch (e: unknown) {
      results[s.id] = { error: errMessage(e) };
    }
  }
  return results;
}

export async function syncPayoutsJob(_opts?: { day?: string }) {
  const shops = await prisma.shop.findMany();
  const results: Record<string, unknown> = {};
  const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
  for (const s of shops) {
    try {
      if (s.platform === 'JUMIA') {
  await fetchPayoutsForShop(s.id, { day: _opts?.day });
  results[s.id] = { ok: true };
      } else if (s.platform === 'KILIMALL') {
        if (s.credentialsEncrypted) {
          const creds = decryptJson(s.credentialsEncrypted as { payload: string });
          const credObj = creds as Record<string, unknown>;
          await kmFetchPayouts({ appId: (credObj?.storeId as string) || (credObj?.appId as string), appSecret: (credObj?.appSecret as string) || (credObj?.app_secret as string), apiBase: (credObj?.apiBase as string) }, { day: _opts?.day });
          results[s.id] = { ok: true };
        } else {
          results[s.id] = { error: 'no credentials' };
        }
      }
    } catch (e: unknown) {
      results[s.id] = { error: errMessage(e) };
    }
  }
  return results;
}

export async function returnsSlaJob() {
  // mark overdue returns and create penalty lines in CommissionLedger (minimal implementation)
  const now = new Date();
  const overdue = await prisma.returnCase.findMany({ where: { dueAt: { lt: now }, pickedAt: null } });
  for (const r of overdue) {
    await prisma.returnCase.update({ where: { id: r.id }, data: { status: 'OVERDUE' } });
    // TODO: compute penalty amount and append to CommissionLedger
  }
  const marketplaceOverdue = await prisma.marketplaceReturn.findMany({
    where: { status: 'WAITING_AT_HUB', dueAt: { lt: now }, attendantId: { not: null } },
  });
  const period = getTradingPeriodFor(now);
  for (const entry of marketplaceOverdue) {
    await prisma.marketplaceReturn.update({
      where: { id: entry.id },
      data: { status: 'CHARGED_TO_ATTENDANT' },
    });
    if (entry.attendantId) {
      await prisma.attendantPayrollAdjustment.create({
        data: {
          attendantId: entry.attendantId,
          periodKey: period.key,
          periodLabel: period.label,
          adjustmentType: 'DISCIPLINE',
          label: `Return not picked (${entry.orderItemId})`,
          amount: Math.round(Number(entry.expectedAmount ?? 0)),
          createdById: entry.attendantId,
        },
      });
    }
  }
  return { processed: overdue.length, marketplaceProcessed: marketplaceOverdue.length };
}

export async function commissionCalcJob() {
  const period = getTradingPeriodFor(new Date());
  const distinctUsers = await prisma.weeklySale.findMany({
    where: {
      AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
    },
    select: { userId: true },
    distinct: ['userId'],
  });

  const processed: Array<{ userId: string; payout: number; totalSales: number; updated: boolean }> = [];
  const errors: Array<{ userId: string; error: string }> = [];

  for (const entry of distinctUsers) {
    try {
      const result = await recomputeWeeklySalesCommission({ userId: entry.userId, period });
      processed.push({ userId: entry.userId, payout: result.payout, totalSales: result.totalSales, updated: result.updated });
    } catch (err) {
      errors.push({ userId: entry.userId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return {
    period: period.key,
    processed: processed.length,
    results: processed,
    errors,
  };
}

export async function priceLearnerJob() {
  // placeholder: look for product cost patterns and mark LEARNED prices
  return { ok: true };
}

export async function onlineOpsSyncJob() {
  await syncOnlineMarketplaceData();
  return { ok: true };
}
