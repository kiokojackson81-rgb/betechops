const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const cred = await prisma.$queryRaw`SELECT id, scope, "clientId", "apiSecret", "refreshToken", "apiBase" FROM "ApiCredential" WHERE scope LIKE 'MARKETPLACE_ACCOUNT:%' AND lower("apiBase") LIKE '%jumia%' ORDER BY "updatedAt" DESC LIMIT 1`;
    if (!cred.length) return console.log('no creds');
    const c = cred[0];
    console.log('cred clientId:', c.clientId);
    const account = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: c.clientId } });
    console.log('matched account:', account ? account.id : null);

    const refresh = async () => {
      const url = new URL('/token', c.apiBase).toString();
      const params = new URLSearchParams({ client_id: c.clientid, grant_type: 'refresh_token', refresh_token: c.refreshToken });
      if (c.apiSecret) params.set('client_secret', c.apiSecret);
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
      console.log('token status', res.status);
      const data = await res.json();
      return data.access_token;
    };

    // Note: intentionally not refreshing token here; we will just call orders using existing creds via our earlier sample
    const token = await (async () => {
      try {
        const url = new URL('/token', c.apiBase).toString();
        const params = new URLSearchParams({ client_id: c.clientid, grant_type: 'refresh_token', refresh_token: c.refreshtoken });
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
        const d = await res.json();
        return d.access_token;
      } catch (e) {
        console.error('token refresh failed', e);
        return null;
      }
    })();

    console.log('token present?', !!token);

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
