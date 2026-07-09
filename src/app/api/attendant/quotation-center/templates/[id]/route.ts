import { NextRequest, NextResponse } from "next/server";
import {
  deleteQuotationTemplate,
  quotationTemplateSchema,
  requireQuoteRequestsStaffActor,
  updateQuotationTemplate,
} from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function guardRequest(request: NextRequest) {
  return requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await guardRequest(request);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = quotationTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid template payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const template = await updateQuotationTemplate(id, parsed.data, {
    id: guard.actorUserId,
    name: guard.name,
    email: guard.email,
  });
  if (!template) {
    return NextResponse.json({ ok: false, error: "Unable to update quotation template." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, template });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const guard = await guardRequest(request);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const deleted = await deleteQuotationTemplate(id);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "Quotation template not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
