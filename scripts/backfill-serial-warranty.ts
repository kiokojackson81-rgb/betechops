import { prisma } from '../src/lib/prisma';
import { Prisma } from '@prisma/client';

async function main() {
  console.log('Starting backfill of serial/warranty from legacy tables');
  const possibleTables = ['legacy_order_items', 'order_items_legacy', 'order_item_legacy', 'legacyOrderItem'];
  let totalUpdated = 0;

  for (const t of possibleTables) {
    try {
      // Try to select a few rows
      const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM ${t} LIMIT 100`);
      if (!rows || rows.length === 0) continue;
      console.log(`Found legacy table ${t} with ${rows.length} sample rows`);

      for (const r of rows) {
        const orderNumber = r.order_number || r.orderNumber || r.order || r.order_ref || r.orderRef;
        const productName = r.product_name || r.productName || r.product || r.name;
        const serial = r.serial || r.serial_number || r.serialNumber || null;
        const warranty = r.warranty || r.warranty_period || r.warrantyText || null;
        if (!orderNumber || !productName) continue;

        // find order
        const order = await prisma.order.findUnique({ where: { orderNumber: String(orderNumber) } });
        if (!order) continue;

        // find product
        const product = await prisma.product.findFirst({ where: { name: String(productName) } });
        if (!product) continue;

        // update order item(s) that match and have null serial/warranty
        const updated = await prisma.orderItem.updateMany({
          where: {
            orderId: order.id,
            productId: product.id,
            AND: [
              ({ serial: { equals: null } } as any),
              ({ warranty: { in: [Prisma.DbNull, Prisma.JsonNull] } } as any),
            ],
          },
          data: { serial: serial ?? undefined, warranty: warranty ?? undefined },
        });
        if (updated.count && updated.count > 0) {
          console.log(`Updated ${updated.count} orderItem(s) for order ${order.orderNumber}`);
          totalUpdated += updated.count;
        }
      }
    } catch (e) {
      // ignore table not found or errors
      // console.error(`Table ${t} not present or failed to read`, e);
    }
  }

  console.log(`Backfill complete. total updated items: ${totalUpdated}`);
}

main().catch((err) => {
  console.error('Backfill failed', err);
  process.exit(1);
});
