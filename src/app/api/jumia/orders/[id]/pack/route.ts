import type { NextRequest } from "next/server";
import { noStoreJson, requireRole } from "@/lib/api";
import { getOrderItems, getShipmentProviders, postOrdersPack } from "@/lib/jumia";
import { prisma } from "@/lib/prisma";

type OrderItemsPayload = { orderItems: Array<{ id: string; shipmentProviderId?: string; [key: string]: unknown }> };

function extractShipmentProviderId(candidate: unknown): string | null {
  if (!candidate || typeof candidate !== "object") return null;
  const c = candidate as Record<string, unknown>;
  const keys = ["shipmentProviderId", "id", "sid", "providerId", "code"];
  for (const key of keys) {
    const value = c[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

async function resolveShipmentProviderId(orderItemId: string, shopId?: string): Promise<string | null> {
  try {
    const resp = await (shopId ? getShipmentProviders({ shopId, orderItemIds: [orderItemId] }) : getShipmentProviders(orderItemId));
    const orderItems = Array.isArray((resp as any)?.orderItems) ? (resp as any).orderItems : [];
    for (const item of orderItems) {
      const providers = Array.isArray(item?.shipmentProviders) ? item.shipmentProviders : [];
      for (const provider of providers) {
        const id = extractShipmentProviderId(provider);
        if (id) return id;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveAndMaybePersistDefault(shopId: string, orderItemId: string): Promise<string | null> {
  // Try default first
  try {
    const row = await prisma.config.findUnique({ where: { key: 'jumia:shipper-defaults' } });
    const defaults = ((row?.json as any) || {}) as Record<string, { providerId: string; label?: string }>;
    const def = defaults?.[shopId]?.providerId;
    if (def && def !== 'auto') return def;
  } catch {}

  // Discover providers
  try {
    const prov = await getShipmentProviders({ shopId, orderItemIds: [orderItemId] }).catch(() => ({ providers: [] as any[] }));
    const providers: any[] = Array.isArray((prov as any)?.providers) ? (prov as any).providers : [];
    if (providers.length === 1) {
      const pid = String((providers[0]?.id ?? providers[0]?.providerId) || "");
      try {
        const row = await prisma.config.findUnique({ where: { key: 'jumia:shipper-defaults' } });
        const next = { ...(((row?.json as any) || {}) as Record<string, { providerId: string; label?: string }>) };
        next[shopId] = { providerId: pid, label: String(providers[0]?.name || providers[0]?.label || pid) };
        await prisma.config.upsert({ where: { key: 'jumia:shipper-defaults' }, update: { json: next }, create: { key: 'jumia:shipper-defaults', json: next } });
      } catch {}
      return pid;
    }
    // Prefer a non-tracking provider
    const pick = providers.find((p) => !p?.requiredTrackingCode) || providers[0];
    if (pick) return String((pick?.id ?? pick?.providerId) || "");
  } catch {}
  return null;
}

function sanitizePayload(body: unknown): OrderItemsPayload | null {
  if (!body || typeof body !== "object") return null;
  const orderItems = (body as { orderItems?: unknown }).orderItems;
  if (!Array.isArray(orderItems)) return null;
  const cleaned = orderItems
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const id = (item as { id?: unknown }).id;
      if (typeof id !== "string" && typeof id !== "number") return null;
      const normalizedId = String(id).trim();
      if (!normalizedId) return null;
      const payloadItem: Record<string, unknown> = { ...item, id: normalizedId };
      return payloadItem;
    })
    .filter(Boolean) as Array<{ id: string; [key: string]: unknown }>;
  if (!cleaned.length) return null;
  return { orderItems: cleaned };
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

  let payload = sanitizePayload(body);
  if (!payload) {
    const shipmentProviderId =
      (body && typeof body === "object" && typeof (body as { shipmentProviderId?: unknown }).shipmentProviderId === "string"
        ? ((body as { shipmentProviderId: string }).shipmentProviderId || "").trim()
        : "") || (shopId ? await resolveAndMaybePersistDefault(shopId, id) : await resolveShipmentProviderId(id, shopId || undefined));
    if (!shipmentProviderId) {
      // Treat path param as orderId: fetch its items and resolve providers per item
      let items: Array<{ id: string }> = [];
      if (shopId) {
        try {
          const itemsResp = await getOrderItems({ shopId, orderId: id });
          items = Array.isArray((itemsResp as any)?.items) ? (itemsResp as any).items : [];
        } catch {}
      }
      const orderItems = [] as Array<{ id: string; shipmentProviderId?: string }>;
      for (const it of items) {
        const resolved = shopId
          ? await resolveAndMaybePersistDefault(shopId, String((it as any)?.id || ""))
          : await resolveShipmentProviderId(String((it as any)?.id || ""), shopId || undefined);
        orderItems.push({ id: String((it as any)?.id || ""), shipmentProviderId: resolved || undefined });
      }
      const cleaned = orderItems.filter((x) => x.id);
      if (!cleaned.length || !cleaned.every((x) => typeof x.shipmentProviderId === "string" && x.shipmentProviderId)) {
        return noStoreJson(
          { ok: false, error: "Unable to determine shipmentProviderId for packing" },
          { status: 400 }
        );
      }
      payload = { orderItems: cleaned };
    } else {
      payload = { orderItems: [{ id, shipmentProviderId }] };
    }
  }

  // Ensure every order item has a shipmentProviderId
  const enriched = await Promise.all(
    payload.orderItems.map(async (item) => {
      if (typeof item.shipmentProviderId === "string" && item.shipmentProviderId.trim()) return item;
      const derived = await resolveShipmentProviderId(item.id, shopId || undefined);
      if (!derived) return item;
      return { ...item, shipmentProviderId: derived };
    })
  );

  if (!enriched.every((item) => typeof item.shipmentProviderId === "string" && item.shipmentProviderId.trim())) {
    return noStoreJson(
      { ok: false, error: "Missing shipmentProviderId for one or more order items" },
      { status: 400 }
    );
  }

  try {
    const result = await postOrdersPack(shopId ? { shopId, orderItems: enriched } : { orderItems: enriched });
    return noStoreJson({ ok: true, orderItems: enriched, result, shopId: shopId || undefined }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.toLowerCase().includes("missing credentials")) {
      return noStoreJson(
        {
          ok: false,
          error: "Missing credentials for Jumia Vendor API",
          hint: "Ensure per-shop OAuth refresh token is configured and pass ?shopId=...",
          shopId: shopId || undefined,
        },
        { status: 400 }
      );
    }
    return noStoreJson({ ok: false, error: message, shopId: shopId || undefined }, { status: 502 });
  }
}
