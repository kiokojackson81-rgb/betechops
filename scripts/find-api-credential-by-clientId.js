#!/usr/bin/env node
const { prisma } = require('../.worker-dist/src/lib/prisma');
(async ()=>{
  const clientId = process.argv[2];
  if(!clientId){ console.error('Usage: node scripts/find-api-credential-by-clientId.js <clientId>'); process.exit(2); }
  try{
    const rec = await prisma.apiCredential.findFirst({ where: { clientId } });
    console.log(rec || 'NOTFOUND');
  }catch(e){ console.error('ERR', e.message||e); process.exit(1);} finally{ await prisma.$disconnect(); }
})();
