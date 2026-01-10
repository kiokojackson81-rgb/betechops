const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const name = 'LabTech Kenya';
    const clientId = '3579f345-a3ac-4e9d-b355-1990f0ad8a54';
    const refreshToken = 'FgXLc5Ege8fo0GAt5b0FNIUN9gCdpsM9_38oAkow9cE';
    const apiBase = 'https://vendor-api.jumia.com';

    const account = await prisma.marketplaceAccount.findFirst({ where: { displayName: name } });
    if (!account) {
      console.error('MarketplaceAccount not found for displayName', name);
      process.exit(2);
    }

    const scope = `MARKETPLACE_ACCOUNT:${account.id}`;
    const existing = await prisma.apiCredential.findFirst({ where: { scope } });
    if (existing) {
      const updated = await prisma.apiCredential.update({ where: { id: existing.id }, data: { clientId, refreshToken, apiBase } });
      console.log('Updated ApiCredential', updated.id, 'for account', name);
    } else {
      const created = await prisma.apiCredential.create({ data: { scope, apiBase, clientId, refreshToken, issuer: 'Bearer' } });
      console.log('Created ApiCredential', created.id, 'for account', name);
    }
  } catch (err) {
    console.error('Upsert failed', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
