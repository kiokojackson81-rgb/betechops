import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireRoleOrBenjamin } from "@/lib/api";
import { buildDividedPdfBuffer } from "@/lib/dividedPdf";
import {
  buildDividedReference,
  computeDividedValues,
  DIVIDED_ADMIN_PHONE,
  DIVIDED_FIXED_DEDUCTION,
  DIVIDED_RATE_PCT,
  DIVIDED_SHARE_PHONE,
  getDividedReportForWeek,
} from "@/lib/dividedReport";
import { syncDividedChatraceContact } from "@/lib/integrations/chatraceDivided";
import { uploadBufferToS3 } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SHARE_TEMPLATE_NAME = "divided_share_ready_short_v1";
const ADMIN_TEMPLATE_NAME = "divided_admin_short_v1";
const DIVIDED_READY_TAG = "divided_ready";
const DIVIDED_SHARE_SENT_TAG = "divided_share_sent";
const DIVIDED_ADMIN_SENT_TAG = "divided_admin_sent";
const DIVIDED_READY_RULE = "divided_ready_rule";
const DIVIDED_TRIGGER_FLOW = "divided_trigger_flow";
const DIVIDED_ADMIN_FLOW = "divided_admin_flow";

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

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

export async function POST(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  let body: { weekStart?: string; periodKey?: string } = {};
  try {
    body = (await req.json().catch(() => ({}))) as { weekStart?: string; periodKey?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const weekStartRaw = normalize(body.weekStart);
  if (!weekStartRaw) {
    return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
  }

  try {
    const report = await getDividedReportForWeek(weekStartRaw);
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
    });
    if (!adminResult.ok) {
      return NextResponse.json(
        {
          error: "Failed to prepare admin Chatrace contact",
          debug: adminResult.debug,
        },
        { status: 502 },
      );
    }

    const shareResult = await syncDividedChatraceContact({
      phone: DIVIDED_SHARE_PHONE,
      firstName: "Divided Share",
      fields: commonFields,
      tagsToRemove: [DIVIDED_READY_TAG],
      tagsToAdd: [DIVIDED_READY_TAG],
    });
    if (!shareResult.ok) {
      return NextResponse.json(
        {
          error: "Failed to trigger divided WhatsApp flow",
          debug: shareResult.debug,
        },
        { status: 502 },
      );
    }

    const responsePayload = {
      ok: true,
      week_start: report.week.weekStartInput,
      week_end: report.week.weekEndInput,
      reference,
      templates_used: [SHARE_TEMPLATE_NAME, ADMIN_TEMPLATE_NAME],
      recipients_used: [DIVIDED_SHARE_PHONE, DIVIDED_ADMIN_PHONE],
      pdf_url: pdfUpload.url,
      send_result: {
        triggered_tag: DIVIDED_READY_TAG,
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

    console.info("[divided][whatsapp] triggered", responsePayload);
    return NextResponse.json(responsePayload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[divided][whatsapp] failed", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
