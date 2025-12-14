// load environment variables from .env so Prisma can connect when run via node
require('dotenv').config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Starting backfill of tasks.sales -> DailySale...");

  // find reports that have tasks.sales
  const reports = await prisma.dailyReport.findMany({
    where: { tasks: { not: null } },
    select: { id: true, tasks: true },
  });

  let createdTotal = 0;
  for (const r of reports) {
    try {
      const tasks = r.tasks || {};
      const sales = Array.isArray(tasks.sales) ? tasks.sales : [];
      if (sales.length === 0) continue;

      const existing = await prisma.dailySale.count({ where: { dailyReportId: r.id } });
      if (existing > 0) {
        console.log(`Skipping report ${r.id} (already has ${existing} sales rows)`);
        continue;
      }

      const data = sales.map((s) => ({
        dailyReportId: r.id,
        productName: s.productName || "",
        price: Number(s.price || 0),
      }));
      if (data.length > 0) {
        const res = await prisma.dailySale.createMany({ data });
        createdTotal += data.length;
        console.log(`Created ${data.length} sales for report ${r.id}`);
      }
    } catch (err) {
      console.error(`Failed processing report ${r.id}:`, err);
    }
  }

  console.log(`Backfill complete. Total sales rows created: ${createdTotal}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
