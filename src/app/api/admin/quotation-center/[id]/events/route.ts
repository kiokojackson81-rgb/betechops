import { NextRequest, NextResponse } from "next/server";
import {
  getQuoteRequestById,
  listQuotationEvents,
  requireQuoteRequestsStaffActor,
} from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  if (!guard.isElevatedActor) {
    return NextResponse.json({ ok: false, error: "Only admin can inspect quotation activity." }, { status: 403 });
  }

  const { id } = await context.params;
  const requestRow = await getQuoteRequestById(id);
  if (!requestRow) {
    return NextResponse.json({ ok: false, error: "Quotation request not found." }, { status: 404 });
  }

  const events = await listQuotationEvents(id);
  return NextResponse.json({ ok: true, request: requestRow, events });
}
