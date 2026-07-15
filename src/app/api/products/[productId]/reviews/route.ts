import { NextResponse } from "next/server";
import { getPublishedProductReviews } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ productId: string }> }) {
  const { productId } = await context.params;
  const reviews = await getPublishedProductReviews(productId);
  return NextResponse.json({ ok: true, ...reviews });
}
