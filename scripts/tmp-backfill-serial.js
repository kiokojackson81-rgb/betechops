// scripts/tmp-backfill-serial.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function tableHasColumns(tableName, cols) {
  const res = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    tableName
  );
  const present = new Set(res.map(r => r.column_name));
  return cols.every(c => present.has(c));
}

async function main() {
  console.log('Temporary backfill (serial/warranty) started');

  // check that OrderItem table has serial/warranty columns
  const hasCols = await tableHasColumns('OrderItem', ['serial', 'warranty']);
  if (!hasCols) {
    console.log('OrderItem table does not have serial/warranty columns. Skipping backfill.');
    return;
  }

  const possibleTables = ['legacy_order_items', 'order_items_legacy', 'order_item_legacy', 'legacyOrderItem'];
  let totalUpdated = 0;

  for (const t of possibleTables) {
    try {
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${t} LIMIT 200`);
      if (!rows || rows.length === 0) continue;
      console.log(`Found legacy table ${t} with ${rows.length} sample rows`);

      for (const r of rows) {
        const orderNumber = r.order_number || r.orderNumber || r.order || r.order_ref || r.orderRef;
        const productName = r.product_name || r.productName || r.product || r.name;
        const serial = r.serial || r.serial_number || r.serialNumber || null;
        const warranty = r.warranty || r.warranty_period || r.warrantyText || null;
        if (!orderNumber || !productName) continue;

        const order = await prisma.order.findUnique({ where: { orderNumber: String(orderNumber) } });
        if (!order) continue;
        const product = await prisma.product.findFirst({ where: { name: String(productName) } });
        if (!product) continue;

        const updated = await prisma.orderItem.updateMany({ where: { orderId: order.id, productId: product.id, serial: null, warranty: null }, data: { serial: serial ?? undefined, warranty: warranty ?? undefined } });
        if (updated.count && updated.count > 0) {
          console.log(`Updated ${updated.count} orderItem(s) for order ${order.orderNumber}`);
          totalUpdated += updated.count;
        }
      }
    } catch (e) {
      // ignore missing table or other errors but log at debug level
      // console.warn(`Skipping ${t}:`, e.message || e);
    }
  }

  console.log(`Temporary backfill complete. total updated items: ${totalUpdated}`);
}

main().then(() => prisma.$disconnect()).catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
