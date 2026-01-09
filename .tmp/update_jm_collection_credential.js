#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');

// New credential from user
const NEW_CLIENT_ID = 'f7df0953-7c18-4191-b304-614f9f0987a4';
const NEW_REFRESH = '3USNy5f3rr89XWye1xc5ELHdvGMsylc2xofdC9Nh1uo';
// Target jumiaAccount id observed returning 400
const TARGET_JUMIA_ACCOUNT_ID = 'cmhvvrkte0000v5b8esvuffmh';

async function main(){
  try{
    const ja = await prisma.jumiaAccount.findUnique({ where: { id: TARGET_JUMIA_ACCOUNT_ID } });
    if (!ja) { console.error('JumiaAccount not found:', TARGET_JUMIA_ACCOUNT_ID); process.exit(2); }
    const oldClient = ja.clientId;
    console.log('Found jumiaAccount:', ja.id, ja.label, 'oldClientId=', oldClient);

    // Update jumiaAccount
    await prisma.jumiaAccount.update({ where: { id: ja.id }, data: { clientId: NEW_CLIENT_ID, refreshToken: NEW_REFRESH } });
    console.log('Updated jumiaAccount clientId and refreshToken');

    // Patch ApiCredential rows referencing old clientId (if any)
    if (oldClient) {
      const creds = await prisma.apiCredential.findMany({ where: { clientId: oldClient } });
      console.log('Found', creds.length, 'ApiCredential rows with old clientId');
      for (const c of creds) {
        await prisma.apiCredential.update({ where: { id: c.id }, data: { clientId: NEW_CLIENT_ID, refreshToken: NEW_REFRESH } });
        console.log('Patched ApiCredential', c.id);
      }
    }

    // Also ensure there's at least one ApiCredential with the NEW_CLIENT_ID; upsert by clientId
    const existingNew = await prisma.apiCredential.findFirst({ where: { clientId: NEW_CLIENT_ID } });
    if (!existingNew) {
      const created = await prisma.apiCredential.create({ data: { clientId: NEW_CLIENT_ID, refreshToken: NEW_REFRESH, apiBase: 'https://vendor-api.jumia.com', scope: `AUTO:jm:${NEW_CLIENT_ID}` } });
      console.log('Created ApiCredential', created.id);
    } else {
      console.log('ApiCredential with new clientId already exists:', existingNew.id);
    }

    console.log('Credential update complete');
  }catch(e){ console.error('ERR', e && e.message ? e.message : e); process.exit(1); } finally { await prisma.$disconnect(); }
}

main();
