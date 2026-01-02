const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const receiptNumber = process.argv[2] || 'Betech-20251230-40824';
  console.log('Inspecting receipt:', receiptNumber);

  const res = await prisma.$queryRaw`
    SELECT "data", "totals", "generatedAt", "receipt_number"
    FROM "Receipt"
    WHERE "receipt_number" = ${receiptNumber}
    LIMIT 1
  `;

  if (!Array.isArray(res) || res.length === 0) {
    console.log('Receipt not found:', receiptNumber);
    return;
  }

  const row = res[0];
  const data = row.data ?? {};
  const totals = row.totals ?? {};
  const generatedAt = row.generatedAt;

  const items = Array.isArray(data.items) ? data.items : [];
  const itemsCount = items.length;

  let buyingSum = 0;
  let missingBuying = false;

  items.forEach((it, i) => {
    const bp = typeof it.buyingPrice === 'number' ? it.buyingPrice : Number(it.buying_price ?? it.buyingPrice ?? 0);
    if (!bp || Number.isNaN(bp) || bp <= 0) missingBuying = true;
    buyingSum += Number(bp || 0);
  });

  const sellingTotal = Number(totals.total ?? totals.totalAmount ?? totals.subtotal ?? 0);
  const profit = sellingTotal - buyingSum;

  console.log(`Date: ${generatedAt}`);
  console.log(`Items: ${itemsCount}`);
  console.log(`Selling total (receipt): KES ${sellingTotal.toLocaleString()}`);
  console.log(`Sum of buying prices: KES ${buyingSum.toLocaleString()}`);
  console.log(`All items priced: ${missingBuying ? 'NO' : 'YES'}`);
  console.log(`Profit (selling - buying): KES ${profit.toLocaleString()}`);
  console.log('');

  if (itemsCount) {
    console.log('Items detail:');
    items.forEach((it, i) => {
      const name = it.productName ?? it.name ?? `item_${i + 1}`;
      const selling = Number(it.sellingPrice ?? it.selling_price ?? it.price ?? 0);
      const buying = Number(it.buyingPrice ?? it.buying_price ?? 0);
      console.log(`- ${name} | selling: ${selling} | buying: ${buying}`);
    });
  }
}

main()
  .catch((e) => { console.error('Script failed:', e.message || e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
