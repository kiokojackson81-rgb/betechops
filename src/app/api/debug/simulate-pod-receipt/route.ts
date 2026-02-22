import { NextRequest } from "next/server";
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

  const receiptNumber = (url.searchParams.get("receiptNumber") || `POD-SIM-${Date.now()}`).toString().trim();
  const customerName = (url.searchParams.get("customerName") || "POD Customer").toString().trim();
  const customerPhone = normalizeRecipientPhone(url.searchParams.get("customerPhone") || "254700000000");
  const amountRaw = (url.searchParams.get("amount") || "100").toString().trim();
  const amountNum = Number(String(amountRaw).replace(/[^0-9.-]/g, "")) || 0;
  const createdBy = (url.searchParams.get("createdBy") || "Ops Debug").toString().trim();
  const adminItems = (url.searchParams.get("adminItems") || "1) Debug POD item x1").toString().trim();

  const podPendingCountRaw = (url.searchParams.get("podPendingCount") || "0").toString().trim();
  const podPendingTotalRaw = (url.searchParams.get("podPendingTotal") || "0").toString().trim();
  const podPendingCountNum = Number(String(podPendingCountRaw).replace(/[^0-9.-]/g, "")) || 0;
  const podPendingTotalNum = Number(String(podPendingTotalRaw).replace(/[^0-9.-]/g, "")) || 0;

  const tagRaw = (
    url.searchParams.get("tag") ||
    process.env.CHATRACE_INTERNAL_POD_ADMIN_TAG ||
    "pod_receipt_admin_alert"
  )
    .toString()
    .trim();
  const tagName = tagRaw === "receipt_admin_alert" ? "pod_receipt_admin_alert" : tagRaw;

  const results: any[] = [];
  for (let i = 0; i < recipients.length; i++) {
    const toPhone = recipients[i]!;
    const rid = `simulate-pod-${Date.now()}-${i + 1}`;
    const res: any = await pushInternalReceiptAlert({
      requestId: rid,
      toPhone,
      tagName,
      receiptNumber,
      amount: String(Math.round(amountNum)),
      formattedAmount: Math.round(amountNum),
      paymentMethod: "POD",
      createdBy,
      itemsText: adminItems,
      customerName,
      customerPhone,
      podPendingCount: Math.round(podPendingCountNum),
      podPendingTotal: Math.round(podPendingTotalNum),
    });
    results.push({
      toPhone,
      ok: Boolean(res?.ok),
      rid: res?.debug?.rid ?? rid,
      error: res?.debug && typeof res.debug === "object" ? (res.debug as any).error ?? null : null,
      debug: res?.debug ?? null,
    });
  }

  return noStoreJson({
    ok: results.every((r) => r.ok),
    tagName,
    receiptNumber,
    recipients,
    results,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
