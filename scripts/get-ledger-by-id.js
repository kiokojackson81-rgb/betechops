#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main(){
  const id = process.argv[2];
  if(!id){ console.error('Usage: node scripts/get-ledger-by-id.js <LEDGER_ID>'); process.exit(1); }
  try{
    const l = await prisma.commissionLedger.findUnique({ where: { id } });
    console.log(JSON.stringify(l, null, 2));
  }catch(e){ console.error(e); process.exitCode=1; }
  finally{ await prisma.$disconnect(); }
}
main();
