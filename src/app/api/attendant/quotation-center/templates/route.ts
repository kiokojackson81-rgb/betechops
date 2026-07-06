import { NextRequest, NextResponse } from "next/server";
import {
  createQuotationTemplate,
  listQuotationTemplates,
  quotationTemplateSchema,
  requireQuoteRequestsStaffActor,
} from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const templates = await listQuotationTemplates({
    activeOnly: request.nextUrl.searchParams.get("all") !== "1",
    q: request.nextUrl.searchParams.get("q") || "",
  });
  return NextResponse.json({ ok: true, templates });
}

export async function POST(request: NextRequest) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  if (!guard.isElevatedActor) {
    return NextResponse.json({ ok: false, error: "Only admin can create quotation templates." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = quotationTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid template payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const template = await createQuotationTemplate(parsed.data, {
    id: guard.actorUserId,
    name: guard.name,
    email: guard.email,
  });
  if (!template) {
    return NextResponse.json({ ok: false, error: "Unable to create quotation template." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, template });
}
