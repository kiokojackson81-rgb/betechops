import fs from "node:fs";
import path from "node:path";

import { computeAdminReceiptSummary } from "@/lib/adminReceiptsSummary";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { buildAdminSummaryMessage } from "@/lib/adminSummaryMessage";
import { sendWhatsAppTextMessage, hasWhatsAppConfig } from "@/lib/notifications/whatsapp";

export type AdminSummaryJobResult = {
  summary: Awaited<ReturnType<typeof computeAdminReceiptSummary>>;
  payload: ReturnType<typeof buildAdminSummaryMessage>;
  start: Date;
  end: Date;
};

type AdminSummaryJobOptions = {
  now?: Date;
  useCutoff?: boolean;
  advanceCutoff?: boolean;
  sendWhatsApp?: boolean;
  adminPhone?: string;
  rangeMode?: "cutoff" | "today";
};

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CUTOFF_FILE = path.join(CACHE_DIR, "last-admin-summary.json");
const DEFAULT_ADMIN_PHONE = "254705663175";

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function readLastCutoff(): Date | null {
  try {
    if (!fs.existsSync(CUTOFF_FILE)) return null;
    const payload = JSON.parse(fs.readFileSync(CUTOFF_FILE, "utf-8"));
    return payload?.lastEnd ? new Date(payload.lastEnd) : null;
  } catch (error) {
    console.warn("Unable to read admin summary cutoff:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

function writeCutoff(end: Date) {
  ensureCacheDir();
  fs.writeFileSync(CUTOFF_FILE, JSON.stringify({ lastEnd: end.toISOString() }, null, 2), "utf-8");
}

function determineRange(now: Date, useCutoff: boolean) {
  const tradingPeriod = getTradingPeriodFor(now);
  let start = tradingPeriod.start;
  if (useCutoff) {
    const lastEnd = readLastCutoff();
    if (lastEnd && lastEnd < now) {
      start = lastEnd;
    }
  }
  const end = now;
  return { start, end };
}

function determineTodayRange(now: Date) {
  const nairobiDate = now.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  const start = new Date(`${nairobiDate}T00:00:00+03:00`);
  const end = now;
  return { start, end };
}

export function getNairobiSummaryDateLabel(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(now);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return `${day}/${month}/${year}`;
}

async function getAllTimePendingPodStats() {
  const receipts = await prisma.receipt.findMany({
    where: {
      data: { path: ["podDelivery", "status"], equals: "pending" },
    },
    select: {
      totals: true,
      order: {
        select: {
          totalAmount: true,
        },
      },
    },
  });

  return receipts.reduce(
    (acc, receipt) => {
      const sale = Number((receipt.totals as any)?.total ?? receipt.order?.totalAmount ?? 0);
      acc.count += 1;
      acc.amount += sale;
      return acc;
    },
    { count: 0, amount: 0 },
  );
}

async function buildPayload(start: Date, end: Date) {
  const [summaryBase, pendingPodStats] = await Promise.all([
    computeAdminReceiptSummary({ start, end, scope: "global", onlyPos: true }),
    getAllTimePendingPodStats(),
  ]);
  const summary = {
    ...summaryBase,
    posReceiptsCount: pendingPodStats.count,
    posTotalSales: pendingPodStats.amount,
  };
  const payload = buildAdminSummaryMessage({ summary, start, end });
  return { summary, payload };
}

export async function runAdminSummaryJob(options: AdminSummaryJobOptions = {}): Promise<AdminSummaryJobResult> {
  const {
    now = new Date(),
    useCutoff = true,
    advanceCutoff = true,
    sendWhatsApp = true,
    adminPhone,
    rangeMode = "cutoff",
  } = options;

  const { start, end } =
    rangeMode === "today" ? determineTodayRange(now) : determineRange(now, useCutoff);
  const { summary, payload } = await buildPayload(start, end);

  if (rangeMode === "cutoff" && advanceCutoff && useCutoff) {
    writeCutoff(end);
  }

  if (sendWhatsApp) {
    const phone = adminPhone ?? process.env.ADMIN_PHONE ?? DEFAULT_ADMIN_PHONE;
    if (phone && hasWhatsAppConfig()) {
      try {
        await sendWhatsAppTextMessage({ to: phone, body: payload.summaryText });
        console.log("Admin summary sent via WhatsApp to", phone);
      } catch (error) {
        console.error("Failed to send WhatsApp admin summary", error instanceof Error ? error.message : error);
      }
    } else {
      console.warn("WhatsApp configuration missing; admin summary not sent");
    }
  }

  return { summary, payload, start, end };
}
