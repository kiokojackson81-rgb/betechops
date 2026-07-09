import { NextRequest, NextResponse } from "next/server";
import {
  quoteRequestResponseSchema,
  getAssignedQuoteRequestById,
  getQuoteRequestById,
  requireQuoteRequestsStaffActor,
  updateQuoteRequestResponse,
} from "@/lib/quoteRequests";
import {
  deliverQuotationNotifications,
  prepareQuotationPdfAssets,
} from "@/lib/quotationNotifications";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = quoteRequestResponseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid quotation response payload." }, { status: 400 });
  }

  const existing =
    guard.isElevatedActor && !request.nextUrl.searchParams.get("impersonateId")
      ? await getQuoteRequestById(id)
      : await getAssignedQuoteRequestById(id, guard.userId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Quotation request not found." }, { status: 404 });
  }

  const updated = await updateQuoteRequestResponse(
    id,
    {
      id: guard.userId,
      name: guard.name,
      email: guard.email,
    },
    parsed.data,
  );

  if (!updated) {
    return NextResponse.json({ ok: false, error: "Unable to update quotation request." }, { status: 500 });
  }

  const assets = await prepareQuotationPdfAssets(updated, {
    name: guard.name,
    email: guard.email,
  });
  const notifications = await deliverQuotationNotifications(updated, {
    pdfBuffer: assets.pdfBuffer,
    pdfUrl: assets.pdfUrl,
    sendEmail: Boolean(parsed.data.sendEmail),
    sendSms: Boolean(parsed.data.sendSms),
    triggerWhatsapp: true,
  });

  return NextResponse.json({
    ok: true,
    request: updated,
    pdfUrl: assets.pdfUrl,
    notifications,
  });
}
