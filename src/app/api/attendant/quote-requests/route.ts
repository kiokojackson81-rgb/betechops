import { NextRequest, NextResponse } from "next/server";
import {
  ensureQuoteRequestAssignments,
  ensureQuoteRequestsSchema,
  listAssignedQuoteRequests,
  requireQuoteRequestsStaffActor,
  type QuoteRequestStatus,
  QUOTE_REQUEST_STATUSES,
} from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

function parseStatus(value: string | null): QuoteRequestStatus | "ALL" {
  const normalized = String(value || "NEW").trim().toUpperCase();
  if (normalized === "ALL") return "ALL";
  return QUOTE_REQUEST_STATUSES.includes(normalized as QuoteRequestStatus)
    ? (normalized as QuoteRequestStatus)
    : "NEW";
}

export async function GET(request: NextRequest) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  await ensureQuoteRequestsSchema();
  await ensureQuoteRequestAssignments();

  const status = parseStatus(request.nextUrl.searchParams.get("status"));
  const q = (request.nextUrl.searchParams.get("q") || "").trim();

  const requests = await listAssignedQuoteRequests({
    userId: guard.userId,
    status,
    q,
  });

  return NextResponse.json({
    ok: true,
    requests,
  });
}
