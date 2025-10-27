// app/api/jumia/proxy/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeJumiaFetch } from "@/lib/jumia";

export const dynamic = "force-dynamic";

const ALLOW = new Set<string>([
  "/shops", "/shops-of-master-shop",
  "/catalog/brands", "/catalog/categories", "/catalog/products", "/catalog/attribute-sets", "/catalog/stock",
  "/feeds/products/create", "/feeds/products/update", "/feeds/products/price", "/feeds/products/stock", "/feeds/products/status",
  "/feeds",
  "/orders", "/orders/items", "/orders/cancel", "/orders/pack", "/orders/ready-to-ship", "/orders/print-labels", "/orders/shipment-providers",
  "/v2/orders/pack",
  "/consignment-order", "/consignment-stock",
  "/payout-statement",
]);

function isAllowed(path: string) {
  if (path.startsWith("/feeds/")) return true;
  if (path.startsWith("/consignment-order/")) return true;
  return ALLOW.has(path);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shopId, method = "GET", path, query, payload } = body as {
      shopId: string; method?: "GET"|"POST"|"PUT"|"PATCH"; path: string;
      query?: Record<string,string|number|boolean>; payload?: any;
    };
    if (!path || !isAllowed(path)) {
      return NextResponse.json({ error: "Path not allowed" }, { status: 400 });
    }

    const shop = await prisma.shop.findUnique({ where: { id: shopId }, include: { apiCredentials: true } });
    if (!shop || !shop.apiCredentials?.length) {
      return NextResponse.json({ error: "Shop or credentials not found" }, { status: 404 });
    }
    const cred = shop.apiCredentials[0];
    const jumiaFetch = makeJumiaFetch({
      apiBase: cred.apiBase || "https://vendor-api.jumia.com",
      clientId: cred.apiKey!,
      refreshToken: cred.apiSecret!,
    });

    const qs = new URLSearchParams();
    for (const [k,v] of Object.entries(query || {})) if (v!==undefined && v!==null) qs.set(k, String(v));
    const urlPath = `${path}${qs.toString() ? `?${qs}` : ""}`;

    const res = await jumiaFetch(urlPath, {
      method,
      body: payload ? JSON.stringify(payload) : undefined,
    });

    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Proxy error" }, { status: 500 });
  }
}
