import { NextResponse } from "next/server";
import { z } from "zod";
import { buildMockQuoteReference, buildQuoteRequestDraft } from "@/app/shop/integrationPlan";

const quoteSchema = z.object({
  name: z.string().trim().min(2),
  phone: z.string().trim().min(7),
  location: z.string().trim().default(""),
  propertyType: z.string().trim().default(""),
  load: z.string().trim().default(""),
  budgetRange: z.string().trim().default(""),
  preferredProducts: z.string().trim().default(""),
  notes: z.string().optional(),
});

// TODO: Persist quote lead for admin handoff when ops integration is enabled.
// TODO: Route quote lead into admin follow-up workflow and assignment queue.
export async function GET() {
  return NextResponse.json({
    ok: true,
    source: "mock" as const,
    quotes: [],
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = quoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid quote payload.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const draft = buildQuoteRequestDraft({
    customerName: parsed.data.name,
    phone: parsed.data.phone,
    location: parsed.data.location,
    propertyType: parsed.data.propertyType,
    loadDescription: parsed.data.load,
    budgetRange: parsed.data.budgetRange,
    preferredProducts: parsed.data.preferredProducts,
    notes: parsed.data.notes,
  });

  return NextResponse.json({
    ok: true,
    source: "mock" as const,
    reference: buildMockQuoteReference(),
    draft,
  });
}
