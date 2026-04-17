import { Prisma } from "@prisma/client";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { buildDividedPdfBuffer } from "@/lib/dividedPdf";
import {
  buildDividedReference,
  computeDividedValues,
  DIVIDED_ADMIN_PHONE,
  DIVIDED_FIXED_DEDUCTION,
  DIVIDED_RATE_PCT,
  DIVIDED_SHARE_PHONE,
  getDividedCompletionStateForWeek,
  getDividedReportForWeek,
} from "@/lib/dividedReport";
import { syncDividedChatraceContact } from "@/lib/integrations/chatraceDivided";
import { uploadBufferToS3 } from "@/lib/storage";

export const SHARE_TEMPLATE_NAME = "divided_share_ready_short_v1";
export const ADMIN_TEMPLATE_NAME = "divided_admin_short_v1";
export const DIVIDED_READY_TAG = "divided_ready";
export const ADMIN_TRIGGER_TAG = "Admin Send Tag";
export const DIVIDED_SHARE_SENT_TAG = "divided_share_sent";
export const DIVIDED_ADMIN_SENT_TAG = "divided_admin_sent";
export const DIVIDED_READY_RULE = "divided_ready_rule";
export const DIVIDED_TRIGGER_FLOW = "divided_trigger_flow";
export const DIVIDED_ADMIN_FLOW = "divided_admin_flow";
const AUTO_SEND_ENTITY = "DividedWhatsAppWeek";
const AUTO_SEND_ACTION = "AUTO_SEND_SUCCESS";

type SendMode = "manual" | "auto";

async function uploadDividedPdf(weekStartInput: string, reference: string, buffer: Buffer) {
  const pathname = `divided/${reference}/divided-${weekStartInput}.pdf`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(pathname, buffer, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { url: blob.url, storage: "blob" as const };
  }

  const bucket = (process.env.S3_BUCKET || "").toString().trim();
  if (bucket) {
    const url = await uploadBufferToS3(bucket, pathname, buffer, "application/pdf", 14);
    return { url, storage: "s3" as const };
  }

  throw new Error("Missing public PDF storage configuration (BLOB_READ_WRITE_TOKEN or S3_BUCKET)");
}

export async function sendDividedWhatsappReport(input: {
  weekStartRaw: string;
  actorId: string;
  mode?: SendMode;
}) {
  const mode = input.mode ?? "manual";
  const report = await getDividedReportForWeek(input.weekStartRaw);
  const weekStartInput = report.week.weekStartInput;

  if (mode === "auto") {
    const existing = await prisma.actionLog.findFirst({
      where: {
        entity: AUTO_SEND_ENTITY,
        entityId: weekStartInput,
        action: AUTO_SEND_ACTION,
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return {
        ok: true,
        skipped: true,
        skip_reason: "already_sent",
        week_start: weekStartInput,
        existing_log_id: existing.id,
      };
    }
  }

  const metrics = computeDividedValues(report);
  const reference = buildDividedReference(report.week.weekEndInput);
  const pdfBuffer = Buffer.from(await buildDividedPdfBuffer(report));
  const pdfUpload = await uploadDividedPdf(report.week.weekStartInput, reference, pdfBuffer);

  const commonFields = {
    week_start: report.week.weekStartInput,
    week_end: report.week.weekEndInput,
    total_sales: metrics.totalSales,
    returns: metrics.returns,
    gross_profit: metrics.grossProfit,
    base_profit: metrics.baseProfit,
    divided: metrics.divided,
    hitech_payout: metrics.hitechPayout,
    equity: metrics.equity,
    reference,
    receipt_url: pdfUpload.url,
    media_url: pdfUpload.url,
    file_url: pdfUpload.url,
    pdf_url: pdfUpload.url,
    report_pdf_url: pdfUpload.url,
    divided_pdf_url: pdfUpload.url,
    fixed_deduction: DIVIDED_FIXED_DEDUCTION,
    divided_rate_pct: DIVIDED_RATE_PCT,
    share_template_name: SHARE_TEMPLATE_NAME,
    admin_template_name: ADMIN_TEMPLATE_NAME,
    divided_ready_rule: DIVIDED_READY_RULE,
    divided_trigger_flow: DIVIDED_TRIGGER_FLOW,
    divided_admin_flow: DIVIDED_ADMIN_FLOW,
  };

  const adminResult = await syncDividedChatraceContact({
    phone: DIVIDED_ADMIN_PHONE,
    firstName: "Divided Admin",
    fields: commonFields,
    tagsToRemove: [ADMIN_TRIGGER_TAG],
    tagsToAdd: [ADMIN_TRIGGER_TAG],
    tagDelayMs: 2000,
  });
  if (!adminResult.ok) {
    throw new Error(`Failed to prepare admin Chatrace contact: ${adminResult.debug.error ?? "unknown"}`);
  }

  const shareResult = await syncDividedChatraceContact({
    phone: DIVIDED_SHARE_PHONE,
    firstName: "Divided Share",
    fields: commonFields,
    tagsToRemove: [DIVIDED_READY_TAG],
    tagsToAdd: [DIVIDED_READY_TAG],
  });
  if (!shareResult.ok) {
    throw new Error(`Failed to trigger divided WhatsApp flow: ${shareResult.debug.error ?? "unknown"}`);
  }

  const responsePayload = {
    ok: true,
    skipped: false,
    week_start: report.week.weekStartInput,
    week_end: report.week.weekEndInput,
    reference,
    templates_used: [SHARE_TEMPLATE_NAME, ADMIN_TEMPLATE_NAME],
    recipients_used: [DIVIDED_SHARE_PHONE, DIVIDED_ADMIN_PHONE],
    pdf_url: pdfUpload.url,
    send_result: {
      triggered_tag: DIVIDED_READY_TAG,
      admin_trigger_tag: ADMIN_TRIGGER_TAG,
      expected_downstream_tags: [DIVIDED_SHARE_SENT_TAG, DIVIDED_ADMIN_SENT_TAG],
      share_contact_id: shareResult.contactId,
      admin_contact_id: adminResult.contactId,
      share_message_id: null,
      admin_message_id: null,
    },
    values: {
      total_sales: metrics.totalSales,
      returns: metrics.returns,
      gross_profit: metrics.grossProfit,
      base_profit: metrics.baseProfit,
      divided: metrics.divided,
      hitech_payout: metrics.hitechPayout,
      equity: metrics.equity,
    },
    chatrace: {
      rule: DIVIDED_READY_RULE,
      recipient_flow: DIVIDED_TRIGGER_FLOW,
      admin_flow: DIVIDED_ADMIN_FLOW,
      share: shareResult.debug,
      admin: adminResult.debug,
    },
  };

  if (mode === "auto") {
    await prisma.actionLog.create({
      data: {
        actorId: input.actorId,
        entity: AUTO_SEND_ENTITY,
        entityId: weekStartInput,
        action: AUTO_SEND_ACTION,
        after: responsePayload as unknown as Prisma.InputJsonValue,
      },
    });
  }

  return responsePayload;
}

export async function maybeAutoSendDividedWhatsappReport(input: {
  weekStartRaw: string;
  actorId: string;
  source: string;
}) {
  const completion = await getDividedCompletionStateForWeek(input.weekStartRaw);
  if (!completion.ready) {
    return {
      ok: true,
      triggered: false,
      reason: "not_ready",
      source: input.source,
      readiness: completion,
    };
  }

  const sendResult = await sendDividedWhatsappReport({
    weekStartRaw: completion.weekStartInput,
    actorId: input.actorId,
    mode: "auto",
  });

  return {
    ok: true,
    triggered: !Boolean((sendResult as any)?.skipped),
    skipped: Boolean((sendResult as any)?.skipped),
    source: input.source,
    readiness: completion,
    sendResult,
  };
}
