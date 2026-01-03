const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

function csvEscape(v){ if (v === null || v === undefined) return ''; return String(v).replace(/"/g,'""'); }

async function main(email){
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.error('user not found', email); process.exit(1); }

  const now = new Date();
  const period = await prisma.commissionPeriod.findFirst({ where: { startDate: { lte: now }, endDate: { gte: now } } });
  if (!period) { console.error('no active commission period found'); process.exit(1); }

  const receipts = await prisma.supportReceipt.findMany({
    where: { dailyEntry: { submittedById: user.id, date: { gte: period.startDate, lte: period.endDate } } },
    select: { id: true, receiptNumber: true, sellingTotal: true, buyingTotal: true, paymentMethod: true, createdAt: true, dailyEntryId: true }
  });

  const outDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const fileName = `brendah_receipts_${period.id}.csv`;
  const outPath = path.join(outDir, fileName);

  const header = ['id','receiptNumber','dailyEntryId','createdAt','paymentMethod','sellingTotal','buyingTotal','profit'];
  const rows = receipts.map(r=>[r.id, r.receiptNumber||'', r.dailyEntryId, r.createdAt.toISOString(), r.paymentMethod, r.sellingTotal, r.buyingTotal, (Number(r.sellingTotal||0)-Number(r.buyingTotal||0))]);

  const csv = [header.join(',')].concat(rows.map(cols=>cols.map(csvEscape).map(v=>`"${v}"`).join(','))).join('\n');
  fs.writeFileSync(outPath, csv, 'utf8');

  const sums = rows.reduce((acc,r)=>{ acc.count++; acc.selling += Number(r[5]||0); acc.buying += Number(r[6]||0); acc.profit += Number(r[7]||0); return acc; }, { count:0, selling:0, buying:0, profit:0 });

  console.log(JSON.stringify({ file: outPath, period: { id: period.id, name: period.name }, receipts: { count: sums.count, sellingTotal: sums.selling, buyingTotal: sums.buying, profit: sums.profit } }, null, 2));
}

const EMAIL = process.argv[2] || 'brendah@betech.co.ke';
main(EMAIL).then(()=>prisma.$disconnect()).catch((e)=>{ console.error(e); prisma.$disconnect(); process.exit(1); });
