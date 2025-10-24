import { prisma } from '@/lib/prisma';
import { fetchOrdersForShop, fetchPayoutsForShop } from '@/lib/jumia';
import { fetchOrders as kmFetchOrders, fetchPayouts as kmFetchPayouts } from '@/lib/connectors/kilimall';
import { decryptJson } from '@/lib/crypto/secure-json';

export async function syncOrdersJob(opts?: { simulate?: boolean }) {
  const shops = await prisma.shop.findMany();
  const results: Record<string, any> = {};
  for (const s of shops as any[]) {
    try {
      if (s.platform === 'JUMIA') {
        const orders = await fetchOrdersForShop(s.id);
        results[s.id] = { count: orders.length };
      } else if (s.platform === 'KILIMALL') {
        if (s.credentialsEncrypted) {
          const creds = decryptJson(s.credentialsEncrypted as any);
          const items = await kmFetchOrders({ appId: creds.storeId || creds.appId, appSecret: creds.appSecret || creds.app_secret, apiBase: creds.apiBase }, { since: undefined });
          results[s.id] = { count: items.length };
        } else {
          results[s.id] = { error: 'no credentials' };
        }
      }
    } catch (e: any) {
      results[s.id] = { error: String(e?.message || e) };
    }
  }
  return results;
}

export async function syncPayoutsJob(opts?: { day?: string }) {
  const shops = await prisma.shop.findMany();
  const results: Record<string, any> = {};
  for (const s of shops as any[]) {
    try {
      if (s.platform === 'JUMIA') {
        const payouts = await fetchPayoutsForShop(s.id, { day: opts?.day });
        results[s.id] = { ok: true };
      } else if (s.platform === 'KILIMALL') {
        if (s.credentialsEncrypted) {
          const creds = decryptJson(s.credentialsEncrypted as any);
          const j = await kmFetchPayouts({ appId: creds.storeId || creds.appId, appSecret: creds.appSecret || creds.app_secret, apiBase: creds.apiBase }, { day: opts?.day });
          results[s.id] = { ok: true };
        } else {
          results[s.id] = { error: 'no credentials' };
        }
      }
    } catch (e: any) {
      results[s.id] = { error: String(e?.message || e) };
    }
  }
  return results;
}

export async function returnsSlaJob() {
  // mark overdue returns and create penalty lines in CommissionLedger (minimal implementation)
  const now = new Date();
  const overdue = await prisma.returnCase.findMany({ where: { dueAt: { lt: now }, pickedAt: null } as any });
  for (const r of overdue) {
    await prisma.returnCase.update({ where: { id: r.id }, data: { status: 'OVERDUE' } as any });
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
