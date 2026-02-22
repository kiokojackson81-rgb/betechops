import { NextRequest, NextResponse } from "next/server";
import { noStoreJson, requireRole } from "@/lib/api";
import { pushInternalReceiptAlert } from "@/lib/chatraceInternalFixed";

function parseRecipients(raw: string) {
  return (raw || "")
    .split(/[,\s;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeRecipientPhone(value?: string) {
  const raw = (value ?? "").toString().trim();
  if (!raw) return "";
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  return digits;
}

function normalizeCustomerType(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

async function authorize(request: NextRequest) {
  // Allow headless verification via secret (header or query): x-cron-secret / cronSecret
  const url = new URL(request.url);
  const cronSecretHeader = request.headers.get("x-cron-secret") || "";
  const cronSecretQuery = (url.searchParams.get("cronSecret") || "").trim();
  const cronSecretEnv = (process.env.CRON_SECRET || "").trim();
  const isCronBySecret = !!cronSecretEnv && (cronSecretHeader === cronSecretEnv || cronSecretQuery === cronSecretEnv);
  if (isCronBySecret) return { ok: true as const, cron: true };

  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return { ok: false as const, res: auth.res };
  return { ok: true as const, cron: false };
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const customerType = normalizeCustomerType(url.searchParams.get("customerType") || "walkin");
  const allowed = new Set(["walkin", "online", "delivery"]);
  if (!allowed.has(customerType)) {
    return noStoreJson({ ok: false, error: `customerType must be one of: walkin, online, delivery (got ${customerType})` }, { status: 400 });
  }

  const recipientsRaw =
    (url.searchParams.get("to") || "").trim() ||
    (process.env.ADMIN_NOTIFICATION_WHATSAPP_NUMBERS || "").toString().trim();
  const recipients = parseRecipients(recipientsRaw).map(normalizeRecipientPhone).filter(Boolean);
  if (!recipients.length) {
    return noStoreJson(
      { ok: false, error: "No recipients. Set ADMIN_NOTIFICATION_WHATSAPP_NUMBERS or pass ?to=2547..." },
      { status: 400 },
    );
  }

  const receiptNumber = (url.searchParams.get("receiptNumber") || `SIM-${Date.now()}`).toString().trim();
  const customerName = (url.searchParams.get("customerName") || "Walk-in Customer").toString().trim();
  const customerPhone = normalizeRecipientPhone(url.searchParams.get("customerPhone") || "254700000000");
  const amountRaw = (url.searchParams.get("amount") || "100").toString().trim();
  const amountNum = Number(String(amountRaw).replace(/[^0-9.-]/g, "")) || 0;
  const paymentMethod = (url.searchParams.get("paymentMethod") || "MPESA").toString().trim();
  const createdBy = (url.searchParams.get("createdBy") || "Ops Debug").toString().trim();
  const adminItems = (url.searchParams.get("adminItems") || "1) Debug item x1").toString().trim();
  const totalSalesTodayRaw = (url.searchParams.get("totalSalesToday") || "0").toString().trim();
  const totalSalesTodayNum = Number(String(totalSalesTodayRaw).replace(/[^0-9.-]/g, "")) || 0;

  const tagName = (process.env.CHATRACE_INTERNAL_ADMIN_TAG || "receipt_admin_alert").toString().trim();

  const results: any[] = [];
  for (let i = 0; i < recipients.length; i++) {
    const toPhone = recipients[i]!;
    const rid = `simulate-${Date.now()}-${i + 1}`;
    const res: any = await pushInternalReceiptAlert({
      requestId: rid,
      toPhone,
      tagName,
      receiptNumber,
      amount: String(Math.round(amountNum)),
      formattedAmount: Math.round(amountNum),
      paymentMethod,
      createdBy,
      itemsText: adminItems,
      customerName,
      customerPhone,
      totalSalesToday: Math.round(totalSalesTodayNum),
    });
    results.push({
      toPhone,
      ok: Boolean(res?.ok),
      rid: res?.debug?.rid ?? rid,
      error: res?.debug && typeof res.debug === 'object' ? (res.debug as any).error ?? null : null,
      debug: res?.debug ?? null,
    });
  }

  return noStoreJson({
    ok: results.every((r) => r.ok),
    customerType,
    recipients,
    tagName,
    receiptNumber,
    results,
  });
}

export async function POST(request: NextRequest) {
  // For convenience, POST just delegates to GET (query params).
  return GET(request);
}
