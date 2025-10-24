import crypto from 'crypto';
import { normalizeFromKilimall } from './normalize';

type ShopCreds = { appId: string; appSecret: string; apiBase: string };

function sign(appSecret: string, body: string, ts: number) {
  return crypto.createHash('md5').update(appSecret + body + String(ts)).digest('hex');
}

export async function kmFetch(shopCreds: ShopCreds, path: string, payload: any) {
  const ts = Date.now();
  const body = JSON.stringify(payload ?? {});
  const s = sign(shopCreds.appSecret, body, ts);
  const res = await fetch(`${shopCreds.apiBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'X-App-Id': shopCreds.appId, 'X-Timestamp': String(ts), 'X-Sign': s },
    body
  });
  if (!res.ok) throw new Error(`Kilimall ${path} ${res.status}`);
  return res.json();
}

export async function fetchOrders(shopCreds: ShopCreds, opts?: { since?: string }) {
  // Example path; adapt to real Kilimall API
  const path = '/orders/list';
  const payload = { since: opts?.since };
  const j = await kmFetch(shopCreds, path, payload);
  // Map array
  const items = Array.isArray(j?.data) ? j.data : j?.orders || [];
  return items.map((r: any) => normalizeFromKilimall(r, shopCreds.appId));
}

export async function fetchPayouts(shopCreds: ShopCreds, opts?: { day?: string }) {
  const path = '/finance/payouts';
  const payload = { day: opts?.day };
  const j = await kmFetch(shopCreds, path, payload);
  return j;
}
