import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getAssignedQuoteRequestById,
  getQuoteRequestById,
  requireQuoteRequestsStaffActor,
  updateQuoteRequestStatus,
} from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

const statusUpdateSchema = z.object({
  status: z.literal("CONTACTED"),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const parsed = statusUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid quotation status." }, { status: 400 });
  }

  const { id } = await context.params;
  const existing =
    guard.isElevatedActor && !request.nextUrl.searchParams.get("impersonateId")
      ? await getQuoteRequestById(id)
      : await getAssignedQuoteRequestById(id, guard.userId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Quotation request not found." }, { status: 404 });
  }
  if (existing.status !== "PENDING") {
    return NextResponse.json(
      { ok: false, error: "Only pending requests can be marked as contacted." },
      { status: 409 },
    );
  }

  const updated = await updateQuoteRequestStatus(id, parsed.data.status, {
    id: guard.userId,
    name: guard.name,
    email: guard.email,
  });

  return NextResponse.json({ ok: true, request: updated });
}
