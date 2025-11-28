import { PrismaClient } from '@prisma/client';

// Script: remove_weeklySummary.mjs
// Purpose: scan dailyReport rows and remove `tasks.dayFields.weeklySummary` key if present.
// Usage (dry-run):
//   node scripts/remove_weeklySummary.mjs --dry
// Real run (destructive):
//   node scripts/remove_weeklySummary.mjs
// IMPORTANT: backup your DB before running this against production.

const prisma = new PrismaClient();

async function main() {
  const dry = process.argv.includes('--dry');
  console.log(`Starting weeklySummary cleanup (dry=${dry})`);

  const rows = await prisma.dailyReport.findMany({
    where: { tasks: { not: null } },
    select: { id: true, tasks: true },
  });

  console.log(`Scanned ${rows.length} rows. Checking for weeklySummary in tasks.dayFields...`);
  let touched = 0;
  for (const r of rows) {
    try {
      const tasks = r.tasks || {};
      const dayFields = tasks.dayFields || {};
      if (Object.prototype.hasOwnProperty.call(dayFields, 'weeklySummary')) {
        touched++;
        const before = dayFields.weeklySummary;
        delete dayFields.weeklySummary;
        // update tasks.dayFields
        const newTasks = { ...tasks, dayFields };
        console.log(`Row ${r.id}: will remove weeklySummary (was: ${JSON.stringify(before)})`);
        if (!dry) {
          await prisma.dailyReport.update({ where: { id: r.id }, data: { tasks: newTasks } });
        }
      }
    } catch (err) {
      console.error(`Error processing row ${r.id}:`, err);
    }
  }

  console.log(`Done. Rows touched: ${touched}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
