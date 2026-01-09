#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');

const CLIENT_ID = 'f7df0953-7c18-4191-b304-614f9f0987a4';
const REFRESH_TOKEN = '3USNy5f3rr89XWye1xc5ELHdvGMsylc2xofdC9Nh1uo';
const MARKETPLACE_ACCOUNT_ID = '0307b9d2-5971-4abd-ab3b-d75bed0bab74';
const API_BASE = process.env.JUMIA_VENDOR_API_BASE || 'https://vendor-api.jumia.com';

async function main(){
  try{
    // Upsert ApiCredential for the marketplace account scope
    const scope = `MARKETPLACE_ACCOUNT:${MARKETPLACE_ACCOUNT_ID}`;
    const existing = await prisma.apiCredential.findFirst({ where: { scope, apiBase: { contains: 'jumia' } } });
    if (existing) {
      await prisma.apiCredential.update({ where: { id: existing.id }, data: { clientId: CLIENT_ID, refreshToken: REFRESH_TOKEN, apiBase: API_BASE } });
      console.log('Updated ApiCredential', existing.id);
    } else {
      const created = await prisma.apiCredential.create({ data: { scope, apiBase: API_BASE, clientId: CLIENT_ID, refreshToken: REFRESH_TOKEN } });
      console.log('Created ApiCredential', created.id);
    }

    // Find JumiaAccount by label fragment and update credentials
    const ja = await prisma.jumiaAccount.findFirst({ where: { label: { contains: 'JM Latest Collections', mode: 'insensitive' } } });
    if (ja) {
      await prisma.jumiaAccount.update({ where: { id: ja.id }, data: { clientId: CLIENT_ID, refreshToken: REFRESH_TOKEN } });
      console.log('Updated JumiaAccount', ja.id, ja.label);
    } else {
      console.log('No JumiaAccount found with label fragment "JM Latest Collections"');
    }

  }catch(e){ console.error('ERR', e.message||e); process.exit(1); } finally { await prisma.$disconnect(); }
}

main();
