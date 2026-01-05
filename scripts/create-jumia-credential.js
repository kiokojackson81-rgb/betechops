#!/usr/bin/env node
const { prisma } = require('../src/lib/prisma');

async function main() {
  const scope = process.env.SCOPE || 'JUMIA_VENDOR';
  const clientId = process.env.JUMIA_CLIENT_ID;
  const refreshToken = process.env.JUMIA_REFRESH_TOKEN;
  const apiBase = process.env.JUMIA_VENDOR_API_BASE || 'https://vendor-api.jumia.com';
  const apiSecret = process.env.JUMIA_CLIENT_SECRET || null;
  const issuer = process.env.JUMIA_AUTH_SCHEME || 'Bearer';
  const shopId = process.env.SHOP_ID || null;

  if (!clientId || !refreshToken) {
    console.error('Environment variables JUMIA_CLIENT_ID and JUMIA_REFRESH_TOKEN are required');
    process.exit(1);
  }

  const where = { scope, shopId };
  const existing = await prisma.apiCredential.findFirst({ where });
  if (existing) {
    const updated = await prisma.apiCredential.update({ where: { id: existing.id }, data: { clientId, refreshToken, apiBase, apiSecret, issuer } });
    console.log('Updated ApiCredential', updated.id);
  } else {
    const created = await prisma.apiCredential.create({ data: { scope, clientId, refreshToken, apiBase, apiSecret, issuer, shopId } });
    console.log('Created ApiCredential', created.id);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { try { await prisma.$disconnect(); } catch (e) {} });
