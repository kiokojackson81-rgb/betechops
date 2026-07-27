import { NextRequest, NextResponse } from "next/server";
import {
  getAssignedQuoteRequestById,
  getQuoteRequestById,
  requireQuoteRequestsStaffActor,
} from "@/lib/quoteRequests";
import { sendQuotationFollowUp } from "@/lib/quotationFollowUps";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const existing =
    guard.isElevatedActor && !request.nextUrl.searchParams.get("impersonateId")
      ? await getQuoteRequestById(id)
      : await getAssignedQuoteRequestById(id, guard.userId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Quotation request not found." }, { status: 404 });
  }

  try {
    const result = await sendQuotationFollowUp(existing.id, {
      trigger: "manual",
      actor: {
        userId: guard.userId,
        name: guard.name,
        email: guard.email,
      },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Unable to send quotation follow-up.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
