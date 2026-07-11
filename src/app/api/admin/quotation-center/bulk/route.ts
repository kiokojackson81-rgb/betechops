import { NextRequest, NextResponse } from "next/server";
import {
  bulkQuoteRequestUpdateSchema,
  bulkUpdateQuoteRequests,
  requireQuoteRequestsStaffActor,
} from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  if (!guard.isElevatedActor) {
    return NextResponse.json({ ok: false, error: "Only admin can run bulk quotation actions." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bulkQuoteRequestUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid bulk quotation payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await bulkUpdateQuoteRequests(parsed.data, {
      userId: guard.userId,
      actorUserId: guard.actorUserId,
      name: guard.name,
      email: guard.email,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Unable to apply bulk quotation update.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
