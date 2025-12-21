import { PrismaClient, WeeklySaleSource, WeeklySaleStatus } from "@prisma/client";

export type TradingPeriod = {
  start: Date; // inclusive
  end: Date; // inclusive
  label: string;
  key: string;
};

const formatLabel = (date: Date) =>
  date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

function getTradingPeriodFor(date: Date): TradingPeriod {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  const day = d.getDate();

  let startYear: number;
  let startMonth: number;
  let endYear: number;
  let endMonth: number;

  if (day >= 25) {
    startYear = year;
    startMonth = month;
    // next month
    const next = new Date(year, month + 1, 1);
    endYear = next.getFullYear();
    endMonth = next.getMonth();
  } else {
    // current period started last month
    const prev = new Date(year, month - 1, 1);
    startYear = prev.getFullYear();
    startMonth = prev.getMonth();
    endYear = year;
    endMonth = month;
  }

  const start = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
  const end = new Date(endYear, endMonth, 24, 23, 59, 59, 999);

  const label = `${formatLabel(start)} – ${formatLabel(end)}`;
  const key = `${start.toISOString().split("T")[0]}_${end.toISOString().split("T")[0]}`;

  return { start, end, label, key };
}

const prisma = new PrismaClient();

function formatKes(value: number) {
  return `KES ${Number(value || 0).toLocaleString("en-KE")}`;
}

async function main() {
  const email = process.env.USER_EMAIL || process.argv[2];
  if (!email) {
    console.error(
      "Usage: USER_EMAIL=foo@betech.co.ke node -r ts-node/register -r tsconfig-paths/register scripts/audit-manual-weekly-sales.ts",
    );
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
      approved: { select: { id: true, name: true, email: true } },
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
      id: entry.id,
      week: `${entry.weekStart.toISOString().slice(0, 10)} -> ${entry.weekEnd.toISOString().slice(0, 10)}`,
      shop: entry.shop?.name ?? "N/A",
      platform: entry.shop?.platform ?? entry.platform,
      amount: formatKes(Number(entry.amount ?? 0)),
      source: entry.source,
      status: entry.status,
      approvedBy: entry.approved ? `${entry.approved.name ?? entry.approved.email} (${entry.approved.email})` : "—",
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

