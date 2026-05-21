import { NextResponse } from "next/server";
import { buildMockProductsResponse } from "@/app/shop/integrationPlan";
import { allShopProducts } from "@/app/shop/shopData";

// TODO: Replace mock product response with Prisma-backed ops catalogue lookup.
export async function GET() {
  return NextResponse.json(buildMockProductsResponse(allShopProducts));
}
