import { NextRequest, NextResponse } from "next/server";
import {
  ensureQuoteRequestAssignments,
  ensureQuoteRequestsSchema,
  listAllQuoteRequests,
  listAssignedQuoteRequests,
  requireQuoteRequestsStaffActor,
  type QuoteRequestSource,
  type QuoteRequestStatus,
  QUOTE_REQUEST_SOURCES,
  QUOTE_REQUEST_STATUSES,
} from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

function parseStatus(value: string | null): QuoteRequestStatus | "ALL" {
  const normalized = String(value || "PENDING").trim().toUpperCase();
  if (normalized === "ALL") return "ALL";
  return QUOTE_REQUEST_STATUSES.includes(normalized as QuoteRequestStatus)
    ? (normalized as QuoteRequestStatus)
    : "PENDING";
}

function parseSource(value: string | null): QuoteRequestSource | "ALL" {
  const normalized = String(value || "ALL").trim().toUpperCase();
  if (normalized === "ALL") return "ALL";
  return QUOTE_REQUEST_SOURCES.includes(normalized as QuoteRequestSource)
    ? (normalized as QuoteRequestSource)
    : "ALL";
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
  const source = parseSource(request.nextUrl.searchParams.get("source"));
  const q = (request.nextUrl.searchParams.get("q") || "").trim();

  const requests =
    guard.isElevatedActor && !request.nextUrl.searchParams.get("impersonateId")
      ? await listAllQuoteRequests({
          status,
          q,
          source,
        })
      : await listAssignedQuoteRequests({
          userId: guard.userId,
          status,
          q,
          source,
        });

  return NextResponse.json({
    ok: true,
    requests,
  });
}
