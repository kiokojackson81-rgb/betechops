import { PrismaClient, WeeklySaleSource, WeeklySaleStatus } from "@prisma/client";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

const prisma = new PrismaClient();

function formatKes(value: number) {
  return `KES ${Number(value || 0).toLocaleString("en-KE")}`;
}

async function main() {
  const email = process.env.USER_EMAIL || process.argv[2];
  if (!email) {
    console.error("Usage: USER_EMAIL=foo@betech.co.ke ts-node -r tsconfig-paths/register scripts/audit-manual-weekly-sales.ts");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error("User not found:", email);
    process.exit(2);
  }

  const period = getTradingPeriodFor(new Date());
  console.log("Trading period:", period.start.toISOString(), "->", period.end.toISOString());

  const entries = await prisma.weeklySale.findMany({
    where: {
      userId: user.id,
      source: WeeklySaleSource.MANUAL,
      status: WeeklySaleStatus.APPROVED,
      AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
    },
    include: {
      shop: { select: { id: true, name: true, platform: true } },
      approved: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { weekStart: "desc" },
  });

  if (!entries.length) {
    console.log("No manual weekly-sales entries found for that period.");
    return;
  }

  console.log(`Found ${entries.length} manual entries (approved).`);
  console.table(
    entries.map((entry) => ({
      week: `${entry.weekStart.toISOString().slice(0, 10)} -> ${entry.weekEnd.toISOString().slice(0, 10)}`,
      shop: entry.shop?.name ?? "N/A",
      platform: entry.shop?.platform ?? entry.platform,
      amount: formatKes(Number(entry.amount ?? 0)),
      source: entry.source,
      status: entry.status,
      approvedBy: entry.approved?.name ?? entry.approvedBy ?? "—",
    })),
  );
}

main()
  .catch((err) => {
    console.error("Error running audit:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
