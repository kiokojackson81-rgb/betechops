import { NextRequest, NextResponse } from "next/server";
import { computeAdminReceiptSummary, normalizePaymentMethod } from "@/lib/adminReceiptsSummary";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { parseDateParam } from "@/lib/dateRange";
import { resolveTargetUserId } from "@/lib/resolveTargetUser";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const attendantId = url.searchParams.get("attendantId") || undefined;
  const paymentMethod = normalizePaymentMethod(url.searchParams.get("paymentMethod"));
  const docType = url.searchParams.get("docType") || undefined;
  const search = url.searchParams.get("q") || undefined;
  const includeLedgerParam = url.searchParams.get("includeLedger");
  const includeLedger = includeLedgerParam === null ? undefined : includeLedgerParam !== "false";
  const salesOnlyParam = url.searchParams.get("salesOnly");
  const salesOnly = salesOnlyParam === null ? undefined : salesOnlyParam !== "false";
  const debugParam = url.searchParams.get("debug");
  const debug = debugParam === "true" || debugParam === "1";
  const scopeParam = url.searchParams.get("scope");
  const scope = scopeParam === "global" ? "global" : "mine";
  const customerType = url.searchParams.get("customerType") || undefined;
  const podStatus = url.searchParams.get("status") || undefined;
  // Pending POD remains live operational work until an outcome is recorded.
  // It must therefore remain visible on the admin desk across all periods.
  const isAllPeriodPendingPodQueue =
    customerType?.toLowerCase() === "pod" && podStatus?.toLowerCase() === "pending";
  const period = getTradingPeriodFor(new Date());
  const start = isAllPeriodPendingPodQueue
    ? new Date("2000-01-01T00:00:00.000Z")
    : parseDateParam(url.searchParams.get("start"), period.start);
  const end = isAllPeriodPendingPodQueue
    ? new Date("2100-01-01T00:00:00.000Z")
    : parseDateParam(url.searchParams.get("end"), period.end, true);
  const identity = await resolveTargetUserId(request);
  const userId = identity.resolvedUserId;
  if (scope === "mine" && !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const onlyPos = ["1", "true", "yes"].includes((url.searchParams.get("onlyPos") || "").toLowerCase());

  try {
    const summary = await computeAdminReceiptSummary({
      start,
      end,
      attendantId,
      paymentMethod,
      docType,
      search,
      includeLedger,
      salesOnly,
      debug,
      scope,
      currentUserId: userId,
      customerType,
      podStatus,
      onlyPos,
    });
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[admin/receipts/summary] failed to load summary", error);
    return NextResponse.json({ error: "Failed to compute receipt summary" }, { status: 500 });
  }
}
