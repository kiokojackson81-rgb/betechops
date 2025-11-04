import type { NextRequest } from "next/server";
import { noStoreJson, requireRole } from "@/lib/api";
import { getOrderItems, postOrdersReadyToShip } from "@/lib/jumia";
import { prisma } from "@/lib/prisma";

function parseOrderItemIds(body: unknown, fallbackId: string): string[] {
  if (body && typeof body === "object") {
    const candidate = (body as { orderItemIds?: unknown }).orderItemIds;
    if (Array.isArray(candidate)) {
      const cleaned = candidate
        .map((id) => (typeof id === "string" || typeof id === "number" ? String(id).trim() : ""))
        .filter(Boolean);
      if (cleaned.length) return cleaned;
    }
    const single = (body as { orderItemId?: unknown }).orderItemId;
    if (typeof single === "string" || typeof single === "number") {
      const normalized = String(single).trim();
      if (normalized) return [normalized];
    }
  }
  return fallbackId ? [fallbackId] : [];
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  let body: unknown = undefined;
  if (req.headers.get("content-type")?.includes("application/json")) {
    try {
      body = await req.json();
    } catch {
      return noStoreJson({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
    }
  }

  const sp = req.nextUrl.searchParams;
  const shopIdParam = (sp.get("shopId") || "").trim();
  let shopId = shopIdParam;
  if (!shopId) {
    try {
      const row = await prisma.jumiaOrder.findUnique({ where: { id }, select: { shopId: true } });
      if (row?.shopId) shopId = row.shopId;
    } catch {}
  }

  let orderItemIds = parseOrderItemIds(body, id);
  if ((!orderItemIds || orderItemIds.length === 0) && shopId) {
    try {
      const itemsResp = await getOrderItems({ shopId, orderId: id });
      const items = Array.isArray(itemsResp?.items) ? itemsResp.items : [];
      orderItemIds = items.map((it: any) => String(it?.id || "")).filter(Boolean);
    } catch {}
  }
  if (!orderItemIds.length) {
    return noStoreJson({ ok: false, error: "orderItemIds required" }, { status: 400 });
  }

  try {
    const result = await postOrdersReadyToShip(shopId ? { shopId, orderItemIds } : { orderItemIds });
    return noStoreJson({ ok: true, orderItemIds, result, shopId: shopId || undefined });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return noStoreJson({ ok: false, error: message }, { status: 502 });
  }
}
