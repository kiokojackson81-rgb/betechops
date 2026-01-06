const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseArg(idx, def) {
  return process.argv[idx] || def;
}

async function refreshToken(apiBase, clientId, refreshToken, clientSecret) {
  const url = new URL('/token', apiBase).toString();
  const params = new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken });
  if (clientSecret) params.set('client_secret', clientSecret);
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  if (!res.ok) throw new Error(`token refresh failed (${res.status})`);
  return (await res.json()).access_token;
}

async function fetchStatements(apiBase, authHeader, createdAfter) {
  const url = new URL('/payout-statement', apiBase);
  url.searchParams.set('createdAfter', createdAfter);
  url.searchParams.set('currency', 'LOCAL');
  url.searchParams.set('size', '1000');
  const res = await fetch(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error(`Failed to fetch payout statements (${res.status})`);
  const data = await res.json();
  return data.statements ?? [];
}

function parseDateOnly(s) {
  if (!s) return null;
  const datePart = String(s).slice(0,10);
  const parts = datePart.split('-').map(v => Number(v));
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;
  const [y,m,d] = parts;
  return new Date(y, m-1, d);
}
function toMonday(d) {
  const dt = new Date(d);
  dt.setHours(0,0,0,0);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return dt;
}

(async () => {
  try {
    const startArg = parseArg(2, '2025-12-29');
    const endArg = parseArg(3, '2026-01-04');
    const start = new Date(startArg + 'T00:00:00');
    const end = new Date(endArg + 'T23:59:59.999');
    console.log('Period:', startArg, '->', endArg);

    const creds = await prisma.$queryRaw`SELECT id, scope, "clientId", "apiSecret", "refreshToken", "apiBase" FROM "ApiCredential" WHERE scope LIKE 'MARKETPLACE_ACCOUNT:%' AND lower("apiBase") LIKE '%jumia%' ORDER BY "updatedAt" DESC`;
    if (!creds.length) {
      console.log('No per-account Jumia ApiCredential rows found');
      process.exit(0);
    }
    for (const c of creds) {
      console.log('---');
      console.log('scope:', c.scope, 'clientId:', c.clientId, 'apiBase:', c.apiBase || 'https://vendor-api.jumia.com');
      let token;
      try {
        token = await refreshToken(c.apiBase || 'https://vendor-api.jumia.com', c.clientId, c.refreshToken, c.apiSecret);
      } catch (err) {
        console.error('Failed to refresh token for', c.scope, err.message || err);
        continue;
      }
      const auth = `Bearer ${token}`;
      let statements = [];
      try {
        statements = await fetchStatements(c.apiBase || 'https://vendor-api.jumia.com', auth, startArg);
      } catch (err) {
        console.error('Failed to fetch statements for', c.scope, err.message || err);
        continue;
      }
      console.log('fetched statements:', statements.length);
      const accountIdFromScope = c.scope.replace('MARKETPLACE_ACCOUNT:', '');
      const accountBySid = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: c.clientId } });
      const mappedAccountId = accountBySid ? accountBySid.id : accountIdFromScope;

      for (const st of statements) {
        const sd = parseDateOnly(st?.period?.startDate) ?? (st.createdAt ? new Date(st.createdAt) : null);
        if (sd && (sd < start || sd > end)) continue;
        const shopSid = st.shopSid ?? null;
        const base = sd ?? new Date(st.createdAt ?? Date.now());
        const weekStart = toMonday(base);
        const weekEnd = new Date(weekStart.getTime());
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23,59,59,999);
        const gross = Number(st?.payout?.amount ?? 0);
        try {
          await prisma.marketplacePayoutWeek.upsert({ where: { accountId_statementNumber: { accountId: mappedAccountId, statementNumber: st.statementNumber } }, create: { accountId: mappedAccountId, statementNumber: st.statementNumber, weekStart, weekEnd, grossSales: gross, payoutAmount: gross, currency: 'KES', isPaid: Boolean(st.paid), rawPayload: st }, update: { grossSales: gross, payoutAmount: gross, isPaid: Boolean(st.paid), rawPayload: st } });
          console.log('Upserted', st.statementNumber, 'amount', gross, 'for account', mappedAccountId);
        } catch (err) {
          console.error('Upsert failed for', st.statementNumber, err.message || err);
        }
      }
    }

    console.log('Done fetching per-account statements');
  } catch (err) {
    console.error('failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
