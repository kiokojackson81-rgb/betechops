import { prisma } from '@/lib/prisma';
import { fetchOrdersForShop, fetchPayoutsForShop } from '@/lib/jumia';
import { fetchOrders as kmFetchOrders, fetchPayouts as kmFetchPayouts } from '@/lib/connectors/kilimall';
import { decryptJson } from '@/lib/crypto/secure-json';

export async function syncOrdersJob() {
  const shops = await prisma.shop.findMany();
  const results: Record<string, unknown> = {};
  const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
  for (const s of shops) {
    try {
      if (s.platform === 'JUMIA') {
        const orders = await fetchOrdersForShop(s.id);
        results[s.id] = { count: orders.length };
      } else if (s.platform === 'KILIMALL') {
        if (s.credentialsEncrypted) {
          const creds = decryptJson(s.credentialsEncrypted as { payload: string });
          const credObj = creds as Record<string, unknown>;
          const items = await kmFetchOrders({ appId: (credObj?.storeId as string) || (credObj?.appId as string), appSecret: (credObj?.appSecret as string) || (credObj?.app_secret as string), apiBase: (credObj?.apiBase as string) }, { since: undefined });
          results[s.id] = { count: (items as unknown[]).length };
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
  return { processed: overdue.length };
}

export async function commissionCalcJob() {
  // placeholder: recompute ledgers
  return { ok: true };
}

export async function priceLearnerJob() {
  // placeholder: look for product cost patterns and mark LEARNED prices
  return { ok: true };
}
