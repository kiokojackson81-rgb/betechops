import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listAllQuoteRequests, type QuoteRequestSource, type QuoteRequestStatus } from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

function isAdminRole(role: string | null | undefined) {
  return role === "ADMIN" || role === "SUPERVISOR";
}

export async function GET(request: NextRequest) {
  const session = await auth().catch(() => null);
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  if (!session || !isAdminRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const status = (request.nextUrl.searchParams.get("status") || "ALL").toUpperCase() as QuoteRequestStatus | "ALL";
  const source = (request.nextUrl.searchParams.get("source") || "ALL").toUpperCase() as QuoteRequestSource | "ALL";
  const assignedAttendantId = request.nextUrl.searchParams.get("staffId");
  const q = request.nextUrl.searchParams.get("q") || "";

  const requests = await listAllQuoteRequests({
    status,
    source,
    assignedAttendantId,
    q,
  });

  return NextResponse.json({ ok: true, requests });
}
