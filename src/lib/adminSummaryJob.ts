import fs from "node:fs";
import path from "node:path";

import { computeAdminReceiptSummary } from "@/lib/adminReceiptsSummary";
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

async function buildPayload(start: Date, end: Date) {
  const summary = await computeAdminReceiptSummary({ start, end, scope: "global" });
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
  } = options;

  const { start, end } = determineRange(now, useCutoff);
  const { summary, payload } = await buildPayload(start, end);

  if (advanceCutoff && useCutoff) {
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
