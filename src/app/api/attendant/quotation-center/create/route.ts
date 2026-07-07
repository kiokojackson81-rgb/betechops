import { NextRequest, NextResponse } from "next/server";
import {
  createManualQuotation,
  manualQuotationCreateSchema,
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

  const body = await request.json().catch(() => null);
  const parsed = manualQuotationCreateSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[quotation-center.create.invalid]", {
      issues: parsed.error.flatten(),
      bodyKeys: body && typeof body === "object" ? Object.keys(body as Record<string, unknown>) : [],
    });
    return NextResponse.json(
      { ok: false, error: "Invalid quotation payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const created = await createManualQuotation(parsed.data, {
      id: guard.userId,
      name: guard.name,
      email: guard.email,
    });

    if (!created) {
      return NextResponse.json({ ok: false, error: "Unable to save quotation." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, request: created });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Unable to save quotation.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
