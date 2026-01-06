import fetch from 'node-fetch';
import { PrismaClient, Platform, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

const DEFAULT_API_BASE = process.env.JUMIA_VENDOR_API_BASE ?? 'https://vendor-api.jumia.com';

function parseDateOnly(s?: string | null) {
  if (!s) return null;
  const datePart = String(s).slice(0, 10);
  const parts = datePart.split('-').map((v) => Number(v));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}
function toMonday(d: Date) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return dt;
}

async function loadGlobalCredentials() {
  const envClientId = process.env.JUMIA_CLIENT_ID?.trim();
  const envRefresh = process.env.JUMIA_REFRESH_TOKEN?.trim();
  if (envClientId && envRefresh) return { source: 'env', clientId: envClientId, refreshToken: envRefresh, clientSecret: process.env.JUMIA_CLIENT_SECRET?.trim() ?? null, baseUrl: process.env.JUMIA_VENDOR_API_BASE?.trim() ?? null, authScheme: process.env.JUMIA_AUTH_SCHEME?.trim() ?? null };
  let credential = await prisma.apiCredential.findFirst({ where: { scope: 'JUMIA_VENDOR' }, orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }] });
  if (!credential) credential = await prisma.apiCredential.findFirst({ where: { scope: 'GLOBAL' }, orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }] });
  if (credential?.clientId && credential.refreshToken) return { source: 'db', credentialId: credential.id, clientId: credential.clientId, clientSecret: credential.apiSecret, refreshToken: credential.refreshToken, baseUrl: credential.apiBase, authScheme: credential.issuer };
  return null;
}

async function refreshToken(creds: any, apiBase: string) {
  const res = await fetch(new URL('/token', apiBase).toString(), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: creds.clientId, grant_type: 'refresh_token', refresh_token: creds.refreshToken, ...(creds.clientSecret ? { client_secret: creds.clientSecret } : {}) }) });
  if (!res.ok) throw new Error('Failed to refresh token ' + res.status);
  const data = await res.json();
  if (data.refresh_token && data.refresh_token !== creds.refreshToken) {
    if (creds.source === 'db' && creds.credentialId) {
      await prisma.apiCredential.update({ where: { id: creds.credentialId }, data: { refreshToken: data.refresh_token } });
    }
  }
  return data.access_token;
}

async function fetchStatements(apiBase: string, authHeader: string, createdAfter: Date) {
  const url = new URL('/payout-statement', apiBase);
  url.searchParams.set('createdAfter', createdAfter.toISOString().split('T')[0]);
  url.searchParams.set('currency', 'LOCAL');
  url.searchParams.set('size', '1000');
  // NOTE: do NOT set paid=true — include unpaid statements too
  const res = await fetch(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error('Failed to fetch payout statements ' + res.status);
  const data = await res.json();
  return data.statements ?? [];
}

async function main() {
  const startArg = process.argv.find((a) => a.startsWith('--start='))?.split('=')[1] || process.argv[2] || '2025-12-29';
  const endArg = process.argv.find((a) => a.startsWith('--end='))?.split('=')[1] || process.argv[3] || '2026-01-04';
  const start = new Date(startArg + 'T00:00:00');
  const end = new Date(endArg + 'T23:59:59.999');
  console.log('Period:', startArg, '->', endArg);

  const creds = await loadGlobalCredentials();
  if (!creds) {
    console.error('No Jumia credentials available (env or ApiCredential rows)');
    process.exit(1);
  }
  const apiBase = creds.baseUrl?.trim() || DEFAULT_API_BASE;
  const token = await refreshToken(creds, apiBase);
  const authHeader = `${creds.authScheme?.trim() || 'Bearer'} ${token}`;

  const accounts = await prisma.marketplaceAccount.findMany({ where: { platform: Platform.JUMIA, isActive: true } });
  const accountsBySid = new Map<string, typeof accounts[number]>();
  accounts.forEach((a) => { if (a.jumiaShopSid) accountsBySid.set(a.jumiaShopSid, a); });

  const statements = await fetchStatements(apiBase, authHeader, start);
  console.log('Fetched statements:', statements.length);
  for (const st of statements) {
    const sd = parseDateOnly((st as any)?.period?.startDate) ?? (st.createdAt ? new Date(st.createdAt) : null);
    if (sd && (sd < start || sd > end)) continue;
    const stmtShopSid = (st as any)?.shopSid ?? (st as any)?.shopSid ?? null;
    const mapped = stmtShopSid ? accountsBySid.get(stmtShopSid) : null;
    if (!mapped) {
      console.warn('No account mapped for statement shopSid', stmtShopSid, 'stmt', st.statementNumber);
      continue;
    }
    const base = sd ?? new Date(st.createdAt ?? Date.now());
    const weekStart = toMonday(base);
    const weekEnd = new Date(weekStart.getTime());
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const gross = Number((st as any)?.payout?.amount ?? 0);

    try {
      await prisma.marketplacePayoutWeek.upsert({ where: { accountId_statementNumber: { accountId: mapped.id, statementNumber: st.statementNumber } }, create: { accountId: mapped.id, statementNumber: st.statementNumber, weekStart, weekEnd, grossSales: gross, payoutAmount: gross, currency: 'KES', isPaid: Boolean((st as any).paid), rawPayload: st as unknown as Prisma.InputJsonValue }, update: { grossSales: gross, payoutAmount: gross, isPaid: Boolean((st as any).paid), rawPayload: st as unknown as Prisma.InputJsonValue } });
      console.log('Upserted', st.statementNumber, 'for account', mapped.displayName ?? mapped.id, 'amount', gross);
    } catch (err) {
      console.warn('Failed upsert for', st.statementNumber, err);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
