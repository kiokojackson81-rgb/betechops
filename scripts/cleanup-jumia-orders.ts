import { prisma } from "../src/lib/prisma";

export async function performCleanup(retentionDays?: number) {
  // Retain for 90 days by default (3 months)
  const days = Number(retentionDays ?? process.env.JUMIA_ORDERS_RETENTION_DAYS ?? 90);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Prefer vendor update time when present, else vendor createdAt, else local createdAt
  const deleted = await prisma.jumiaOrder.deleteMany({
    where: {
      OR: [
        { updatedAtJumia: { lt: cutoff } },
        { AND: [ { updatedAtJumia: null }, { createdAtJumia: { lt: cutoff } } ] },
        { AND: [ { updatedAtJumia: null }, { createdAtJumia: null }, { createdAt: { lt: cutoff } } ] },
      ],
    },
  });

  // Also remove normalized orders older than cutoff for JUMIA shops, along with their items and return cases.
  // These relations may use foreign keys with CASCADE; still delete in safe order to avoid orphans when cascade is not present.
  let deletedReturnCases = 0;
  let deletedOrderItems = 0;
  let deletedOrders = 0;
  try {
    // Delete return cases tied to old orders from JUMIA shops
    const rc = await prisma.returnCase.deleteMany({
      where: {
        order: {
          createdAt: { lt: cutoff },
          shop: { platform: 'JUMIA' },
        },
      },
    });
    deletedReturnCases = rc.count;
  } catch {}

  try {
    // Delete order items for those old orders first
    const oi = await prisma.orderItem.deleteMany({
      where: {
        order: {
          createdAt: { lt: cutoff },
          shop: { platform: 'JUMIA' },
        },
      },
    });
    deletedOrderItems = oi.count;
  } catch {}

  try {
    const od = await prisma.order.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        shop: { platform: 'JUMIA' },
      },
    });
    deletedOrders = od.count;
  } catch {}

  return { retentionDays: days, cutoff, deleted: deleted.count, deletedOrders, deletedOrderItems, deletedReturnCases };
}

async function main() {
  const result = await performCleanup();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, retentionDays: result.retentionDays, cutoff: result.cutoff.toISOString(), deleted: result.deleted, deletedOrders: result.deletedOrders, deletedOrderItems: result.deletedOrderItems, deletedReturnCases: result.deletedReturnCases }));
}

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("cleanup-jumia-orders failed", err);
    process.exit(1);
  });
}
