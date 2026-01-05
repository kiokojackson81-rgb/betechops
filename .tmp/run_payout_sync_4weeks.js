const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function dateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

async function refreshToken(apiBase, clientId, refreshToken, clientSecret) {
  const url = new URL('/token', apiBase).toString();
  const params = new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken });
  if (clientSecret) params.set('client_secret', clientSecret);
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  if (!res.ok) throw new Error(`token refresh failed (${res.status})`);
  const data = await res.json();
  return data.access_token;
}

function deriveWeekWindow(statement) {
  const start = statement.period?.startDate ? new Date(statement.period.startDate) : statement.createdAt ? new Date(statement.createdAt) : new Date();
  const end = statement.period?.endDate ? new Date(statement.period.endDate) : new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  return { weekStart: start, weekEnd: end };
}

(async () => {
  try {
    const lookbackDays = 28;
    const createdAfter = dateNDaysAgo(lookbackDays);
    const createdBefore = new Date().toISOString().split('T')[0];

    const accounts = await prisma.marketplaceAccount.findMany({ where: { platform: 'JUMIA', isActive: true } });
    console.log('Jumia accounts found:', accounts.length);

    let totalStatements = 0;
    let upserted = 0;

    for (const acct of accounts) {
      let cred = await prisma.apiCredential.findFirst({ where: { clientId: acct.jumiaShopSid } });
      if (!cred) {
        cred = await prisma.apiCredential.findFirst({ where: { scope: 'GLOBAL' } });
      }
      if (!cred) {
        console.warn('No credential for account', acct.id, acct.displayName);
        continue;
      }
      const apiBase = cred.apiBase || 'https://vendor-api.jumia.com';
      let token;
      try {
        token = await refreshToken(apiBase, cred.clientId, cred.refreshToken, cred.apiSecret);
      } catch (err) {
        console.warn('Failed to refresh token for', acct.id, err.message || err);
        continue;
      }
      const auth = `Bearer ${token}`;
      const url = new URL('/payout-statement', apiBase);
      url.searchParams.set('createdAfter', createdAfter);
      url.searchParams.set('createdBefore', createdBefore);
      url.searchParams.set('currency', 'LOCAL');
      url.searchParams.set('size', '1000');
      if (acct.jumiaShopSid) url.searchParams.set('shopSid', acct.jumiaShopSid);

      let res;
      try {
        res = await fetch(url.toString(), { headers: { Authorization: auth } });
      } catch (err) {
        console.warn('HTTP error fetching statements for', acct.id, err.message || err);
        continue;
      }
      if (!res.ok) {
        console.warn('Failed fetching statements for', acct.id, res.status);
        continue;
      }
      const data = await res.json();
      const statements = data.statements ?? [];
      console.log(`Account ${acct.displayName ?? acct.id} -> statements:`, statements.length);
      totalStatements += statements.length;

      for (const statement of statements) {
        const { weekStart, weekEnd } = deriveWeekWindow(statement);
        const payoutAmount = Number(statement.payout?.amount ?? 0);
        // Prefer mapping by statement.shopSid when present to avoid assigning statements to the wrong account
        const stmtShopSid = statement.shopSid ?? null;
        let targetAccountId = acct.id;
        if (stmtShopSid) {
          const mapped = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: stmtShopSid } });
          if (mapped) targetAccountId = mapped.id;
        }
        try {
          // Avoid creating the same statementNumber under multiple accounts: check if exists elsewhere
          const existing = await prisma.marketplacePayoutWeek.findFirst({ where: { statementNumber: statement.statementNumber } });
          if (existing && existing.accountId !== targetAccountId) {
            // If the existing row's rawPayload indicates the same shopSid, prefer the mapped account and update if necessary
            const existingShopSid = existing.rawPayload?.shopSid ?? null;
            if (existingShopSid && stmtShopSid && existingShopSid === stmtShopSid) {
              // If the target account already has a row for this statementNumber, update that row instead.
              const targetExisting = await prisma.marketplacePayoutWeek.findUnique({ where: { accountId_statementNumber: { accountId: targetAccountId, statementNumber: statement.statementNumber } } });
              if (targetExisting) {
                await prisma.marketplacePayoutWeek.update({ where: { id: targetExisting.id }, data: { grossSales: payoutAmount, payoutAmount: payoutAmount, isPaid: Boolean(statement.paid), rawPayload: statement } });
                upserted++;
                continue;
              }
              // Update existing to point to the mapped account (no conflicting target row)
              await prisma.marketplacePayoutWeek.update({ where: { id: existing.id }, data: { accountId: targetAccountId, grossSales: payoutAmount, payoutAmount: payoutAmount, isPaid: Boolean(statement.paid), rawPayload: statement } });
              upserted++;
              continue;
            }
            // Otherwise skip to avoid duplicate statementNumbers across accounts
            console.warn('Skipping statement already present for another account', statement.statementNumber, existing.accountId, '->', targetAccountId);
            continue;
          }
          await prisma.marketplacePayoutWeek.upsert({
            where: {
              accountId_statementNumber: {
                accountId: targetAccountId,
                statementNumber: statement.statementNumber,
              },
            },
            create: {
              accountId: targetAccountId,
              statementNumber: statement.statementNumber,
              weekStart,
              weekEnd,
              grossSales: payoutAmount,
              payoutAmount: payoutAmount,
              currency: 'KES',
              isPaid: Boolean(statement.paid),
              rawPayload: statement,
            },
            update: {
              grossSales: payoutAmount,
              payoutAmount: payoutAmount,
              isPaid: Boolean(statement.paid),
              rawPayload: statement,
            },
          });
          upserted++;
        } catch (err) {
          console.warn('Upsert failed for statement', statement.statementNumber, String(err));
        }
      }
    }

    console.log('Total statements found:', totalStatements);
    console.log('Upserted payout weeks:', upserted);
  } catch (err) {
    console.error('Run failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();