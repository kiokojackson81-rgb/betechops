import { prisma } from "@/lib/prisma";

export async function performCleanup(retentionDays?: number) {
  const days = Number(retentionDays ?? process.env.JUMIA_ORDERS_RETENTION_DAYS ?? 60);
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

  return { retentionDays: days, cutoff, deleted: deleted.count };
}

async function main() {
  const result = await performCleanup();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, retentionDays: result.retentionDays, cutoff: result.cutoff.toISOString(), deleted: result.deleted }));
}

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("cleanup-jumia-orders failed", err);
    process.exit(1);
  });
}
