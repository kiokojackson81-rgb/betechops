import { NextRequest, NextResponse } from "next/server";
import { fetchSyncedRows } from "@/app/admin/orders/_lib/fetchSyncedRows";
import type { OrdersQuery } from "@/app/admin/orders/_lib/types";
import { requireRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const params: OrdersQuery = {
    status: url.searchParams.get("status") ?? undefined,
    country: url.searchParams.get("country") ?? undefined,
    shopId: url.searchParams.get("shopId") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    size: url.searchParams.get("size") ?? undefined,
  };

  try {
    const rows = await fetchSyncedRows(params);
    const res = NextResponse.json({ orders: rows, nextToken: null, isLastPage: true });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    console.error("[api.orders.synced] failed", error);
    return NextResponse.json({ orders: [], error: "Failed to load cached orders" }, { status: 500 });
  }
}
