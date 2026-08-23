import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getServiceZone } from "@/lib/agents/kenyaMarkets";
import { getShopProductBySlugOrOpsProductId } from "@/app/shop/shopApi";
import { calculateDataLoggerFee, isProductLinkedSiteVisitEligible } from "@/lib/siteVisitPolicy";

const pricingSchema = z.object({
  county: z.string().trim().min(2).max(120),
  town: z.string().trim().min(2).max(120),
  originProductId: z.string().trim().min(1).max(160),
  originProductSlug: z.string().trim().min(1).max(240),
  dataLoggerRequested: z.boolean().optional(),
  dataLoggerDays: z.coerce.number().int().min(1).max(3).optional(),
});

export async function POST(request: Request) {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Please sign in to continue." }, { status: 401 });
  const parsed = pricingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Select a recognized county and town." }, { status: 400 });

  const zone = getServiceZone(parsed.data.county, parsed.data.town);
  if (!zone) return NextResponse.json({ ok: false, error: "Select a recognized county and town." }, { status: 400 });
  const product = await getShopProductBySlugOrOpsProductId(parsed.data.originProductSlug, parsed.data.originProductId);
  if (!product) return NextResponse.json({ ok: false, error: "The selected product is no longer available." }, { status: 404 });
  if (!isProductLinkedSiteVisitEligible(product.price)) return NextResponse.json({ ok: false, error: "This product does not qualify for product-linked Site Visits." }, { status: 400 });

  const dataLogger = calculateDataLoggerFee(Boolean(parsed.data.dataLoggerRequested), parsed.data.dataLoggerDays);
  return NextResponse.json({
    ok: true,
    product: { id: product.opsProductId || product.id, name: product.name, slug: product.slug, price: product.price, category: product.category, image: product.image },
    location: { county: parsed.data.county, town: parsed.data.town },
    zone: { id: zone.id, name: zone.name },
    siteVisitFee: zone.siteVisitFee,
    dataLogger: { requested: dataLogger.days > 0, ...dataLogger },
    totalPayable: zone.siteVisitFee + dataLogger.fee,
    eligibleSiteVisitCredit: zone.siteVisitFee,
  });
}
