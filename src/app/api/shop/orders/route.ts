import { NextResponse } from "next/server";
import { z } from "zod";
import { adminHandoffWorkflow, buildEcommerceOrderDraft, buildMockOrderReference } from "@/app/shop/integrationPlan";
import { allShopProducts } from "@/app/shop/shopData";

const orderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().trim().min(1),
      quantity: z.number().int().positive(),
    }),
  ).min(1),
  customerName: z.string().trim().min(2),
  customerPhone: z.string().trim().min(7),
  location: z.string().trim().min(2),
  deliveryMethod: z.string().trim().min(2),
  paymentPreference: z.string().trim().min(2),
  notes: z.string().optional(),
});

// TODO: Persist draft into ops ecommerce order table when integration is enabled.
// TODO: Link matching customer from existing customer database.
// TODO: Link final receipt/POS record back to this draft order.
export async function GET() {
  return NextResponse.json({
    ok: true,
    source: "mock" as const,
    orders: [],
    workflow: adminHandoffWorkflow,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = orderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid order payload.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const allKnown = parsed.data.items.every((item) => allShopProducts.some((product) => product.id === item.productId));
  if (!allKnown) {
    return NextResponse.json({ ok: false, error: "One or more products were not found." }, { status: 400 });
  }

  const draft = buildEcommerceOrderDraft({
    customerName: parsed.data.customerName,
    phone: parsed.data.customerPhone,
    location: parsed.data.location,
    deliveryMethod: parsed.data.deliveryMethod,
    paymentPreference: parsed.data.paymentPreference,
    items: parsed.data.items,
    notes: parsed.data.notes,
  });

  return NextResponse.json({
    ok: true,
    source: "mock" as const,
    status: "pending_mock" as const,
    orderRef: buildMockOrderReference(),
    draft,
  });
}
