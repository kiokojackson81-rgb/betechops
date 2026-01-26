#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const rows = await prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'MarketplacePayoutWeek' ORDER BY ordinal_position`;
  console.log('COLUMNS for MarketplacePayoutWeek:');
  for(const r of rows) console.log(r.column_name, r.data_type);
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
