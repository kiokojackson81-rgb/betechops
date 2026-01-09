#!/usr/bin/env node
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async ()=>{
  try {
    const rows = await prisma.marketplacePayoutWeek.findMany({ where: { statementNumber: { contains: '260105' } }, orderBy: [{ createdAt: 'asc' }] });
    console.log('Found', rows.length, 'rows');
    for (const r of rows) console.log({ id: r.id, accountId: r.accountId, statementNumber: r.statementNumber, weekStart: r.weekStart, weekEnd: r.weekEnd, rawPayload: r.rawPayload });
  } catch (e) { console.error('err', e); process.exit(2); }
  finally { await prisma.$disconnect(); }
})();
