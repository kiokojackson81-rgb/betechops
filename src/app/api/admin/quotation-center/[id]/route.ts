import { NextRequest, NextResponse } from "next/server";
import { deleteQuoteRequest, requireQuoteRequestsStaffActor } from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  if (!guard.isElevatedActor) {
    return NextResponse.json({ ok: false, error: "Only admin can delete quotations here." }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const deleted = await deleteQuoteRequest(id, {
      userId: guard.userId,
      isElevatedActor: true,
    });
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Quotation not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    const message = error instanceof Error && error.message.trim() ? error.message : "Unable to delete quotation.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
