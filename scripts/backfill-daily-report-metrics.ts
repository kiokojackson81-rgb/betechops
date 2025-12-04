import "dotenv/config";
import { prisma } from "../src/lib/prisma.ts";
import type { DailyReport, Prisma } from "@prisma/client";

type DailyReportRow = Pick<
  DailyReport,
  | "id"
  | "tasks"
  | "newProducts"
  | "productsEdited"
  | "copiesUploaded"
  | "walkInServed"
  | "purchasesMade"
  | "liveSessionsCount"
  | "commissionEarned"
  | "confirmedCompetitiveness"
  | "marketEngagement"
  | "concerns"
  | "createdAt"
>;

type MetricsPayload = {
  newProducts?: unknown;
  productsEdited?: unknown;
  copiesUploaded?: unknown;
  walkInServed?: unknown;
  purchasesMade?: unknown;
  liveSessionsCount?: unknown;
  commissionEarned?: unknown;
  confirmedCompetitiveness?: unknown;
  marketEngagement?: unknown;
  concerns?: unknown;
};

const toNumber = (value: unknown): number | null => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const toInt = (value: unknown): number | null => {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  return Math.round(parsed);
};

const toBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (value === null || typeof value === "undefined") return null;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return null;
};

async function run() {
  const batchSize = Number(process.env.DAILY_REPORT_BACKFILL_BATCH || 250);
  let cursor: string | null = null;
  let updatedCount = 0;
  let scanned = 0;

  console.log(`[backfill] Starting daily report metrics backfill with batchSize=${batchSize}`);

  while (true) {
    const reports: DailyReportRow[] = await prisma.dailyReport.findMany({
      select: {
        id: true,
        tasks: true,
        newProducts: true,
        productsEdited: true,
        copiesUploaded: true,
        walkInServed: true,
        purchasesMade: true,
        liveSessionsCount: true,
        commissionEarned: true,
        confirmedCompetitiveness: true,
        marketEngagement: true,
        concerns: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (reports.length === 0) break;

    for (const report of reports) {
      scanned += 1;
      const tasks = report.tasks as { metrics?: MetricsPayload } | null | undefined;
      const metrics = tasks?.metrics;
      if (!metrics || typeof metrics !== "object") continue;

      const updateData: Record<string, unknown> = {};
      type IntField =
        | "newProducts"
        | "productsEdited"
        | "copiesUploaded"
        | "walkInServed"
        | "purchasesMade"
        | "liveSessionsCount";
      const assignInt = (key: keyof MetricsPayload, field: IntField) => {
        const parsed = toInt(metrics[key]);
        if (parsed === null) return;
        const current = typeof report[field] === "number" ? (report[field] as number) : Number(report[field] ?? 0);
        if (current !== parsed) updateData[field] = parsed;
      };
      const assignDecimal = (key: keyof MetricsPayload, field: "commissionEarned") => {
        const parsed = toNumber(metrics[key]);
        if (parsed === null) return;
        const current = Number(report[field] ?? 0);
        if (current !== parsed) updateData[field] = parsed;
      };
      const assignBoolean = (key: keyof MetricsPayload, field: "confirmedCompetitiveness") => {
        const parsed = toBoolean(metrics[key]);
        if (parsed === null) return;
        const current = typeof report[field] === "boolean" ? (report[field] as boolean) : Boolean(report[field]);
        if (current !== parsed) updateData[field] = parsed;
      };

      assignInt("newProducts", "newProducts");
      assignInt("productsEdited", "productsEdited");
      assignInt("copiesUploaded", "copiesUploaded");
      assignInt("walkInServed", "walkInServed");
      assignInt("purchasesMade", "purchasesMade");
      assignInt("liveSessionsCount", "liveSessionsCount");
      assignDecimal("commissionEarned", "commissionEarned");
      assignBoolean("confirmedCompetitiveness", "confirmedCompetitiveness");

      if (metrics.marketEngagement && typeof metrics.marketEngagement === "object") {
        if (JSON.stringify(report.marketEngagement ?? null) !== JSON.stringify(metrics.marketEngagement)) {
          updateData.marketEngagement = metrics.marketEngagement as Prisma.JsonValue;
        }
      }

      if (typeof metrics.concerns === "string" && metrics.concerns.trim().length > 0) {
        if ((report.concerns || "").trim() !== metrics.concerns.trim()) {
          updateData.concerns = metrics.concerns.trim();
        }
      }

      if (Object.keys(updateData).length === 0) continue;

      await prisma.dailyReport.update({ where: { id: report.id }, data: updateData });
      updatedCount += 1;
    }

    cursor = reports[reports.length - 1].id;
    console.log(`[backfill] Processed ${scanned} reports so far. Updated ${updatedCount}. Last cursor=${cursor}`);
  }

  await prisma.$disconnect();
  console.log(`[backfill] Completed. Total scanned=${scanned}. Reports updated=${updatedCount}.`);
}

run().catch((err) => {
  console.error("[backfill] Failed:", err);
  prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
