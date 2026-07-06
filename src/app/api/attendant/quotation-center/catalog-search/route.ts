import { NextRequest, NextResponse } from "next/server";
import { searchLiveCatalog } from "@/lib/aiCatalog";
import { requireQuoteRequestsStaffActor } from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const query = String(request.nextUrl.searchParams.get("query") || "").trim();
  const limit = Math.max(1, Math.min(10, Number(request.nextUrl.searchParams.get("limit") || "6")));

  if (!query) {
    return NextResponse.json({ ok: true, products: [] });
  }

  const catalog = await searchLiveCatalog({
    query,
    origin: "https://www.betech.co.ke",
    limit,
  });

  return NextResponse.json({
    ok: true,
    query,
    resultCount: catalog.resultCount,
    products: catalog.products,
    primary: catalog.primary,
  });
}
