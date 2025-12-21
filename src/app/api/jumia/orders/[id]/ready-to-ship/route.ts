import type { NextRequest } from "next/server";
import { noStoreJson, requireRole } from "@/lib/api";
import { getOrderItems, getShipmentProviders, postOrdersPack, postOrdersPackV2, postOrdersReadyToShip } from "@/lib/jumia";
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

const mapOrderItemId = (it: any): string =>
  String(it?.id || it?.orderItemId || it?.order_item_id || "");

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
  let vendorItems: any[] = [];

  if (shopId) {
    try {
      const itemsResp = await getOrderItems({ shopId, orderId: id });
      vendorItems = Array.isArray(itemsResp?.items) ? itemsResp.items : [];
    } catch {
      vendorItems = [];
    }
  }

  if (vendorItems.length) {
    const extractedIds = vendorItems
      .map(mapOrderItemId)
      .filter(Boolean);
    if (extractedIds.length) {
      orderItemIds = extractedIds;
    }
  }

  if (!orderItemIds.length) {
    return noStoreJson({ ok: false, error: "orderItemIds required" }, { status: 400 });
  }

  try {
    // Auto-pack if needed (when items are still PENDING) using default or single provider
    if (shopId) {
      try {
        if (!vendorItems.length) {
          try {
            const retry = await getOrderItems({ shopId, orderId: id });
            vendorItems = Array.isArray(retry?.items) ? retry.items : [];
          } catch {
            vendorItems = [];
          }
        }
        const allItems = vendorItems.length ? vendorItems : [];
        if (vendorItems.length) {
          const extractedIds = vendorItems.map(mapOrderItemId).filter(Boolean);
          if (extractedIds.length) {
            orderItemIds = extractedIds;
          }
        }
        const idsSet = new Set(orderItemIds.map((oid) => String(oid)));
        const target = allItems.filter((it: any) => {
          return idsSet.has(mapOrderItemId(it));
        });
        const pending = target.filter((it: any) => String(it?.status || "").toUpperCase() === "PENDING");
        if (pending.length > 0) {
          // Load default provider
          let defaults: Record<string, { providerId: string; label?: string }> = {};
          try {
            const row = await prisma.config.findUnique({ where: { key: 'jumia:shipper-defaults' } });
            defaults = ((row?.json as any) || {}) as Record<string, { providerId: string; label?: string }>;
          } catch {}
          let providerId = defaults?.[shopId]?.providerId || "";

          // Discover providers if no default
          let requiredTracking = false;
          if (!providerId || providerId === 'auto') {
            const prov = await getShipmentProviders({ shopId, orderItemIds: [String(pending[0]?.id)] }).catch(() => ({ providers: [] as any[] }));
            const providers: any[] = Array.isArray((prov as any)?.providers) ? (prov as any).providers : [];
            if (providers.length === 1) {
              providerId = String((providers[0]?.id ?? providers[0]?.providerId) || "");
              requiredTracking = !!providers[0]?.requiredTrackingCode;
              // Persist single-provider default for this shop
              try {
                const next = { ...(defaults || {}) } as Record<string, { providerId: string; label?: string }>;
                next[shopId] = { providerId, label: String(providers[0]?.name || providers[0]?.label || providerId) };
                await prisma.config.upsert({ where: { key: 'jumia:shipper-defaults' }, update: { json: next }, create: { key: 'jumia:shipper-defaults', json: next } });
              } catch {}
            } else if (providers.length > 1) {
              // Prefer a provider that does not require tracking code
              const pick = providers.find((p) => !p?.requiredTrackingCode) || providers[0];
              providerId = String((pick?.id ?? pick?.providerId) || "");
              requiredTracking = !!pick?.requiredTrackingCode;
            }
          }

          // If still no providerId, stop with guidance
          if (!providerId) {
            return noStoreJson(
              { ok: false, error: "No shipment provider configured for this shop", hint: "Save a default in Settings → Jumia → Shipping Stations or ensure only one provider is active", shopId },
              { status: 400 }
            );
          }

          // Pack pending items before RTS
          const toPackIds: string[] = pending.map(mapOrderItemId);
          if (requiredTracking) {
            const base = String(toPackIds[0]).slice(0, 8);
            const trackingCode = `AUTO-${base}-${Date.now()}`.slice(0, 32);
            await postOrdersPackV2({ shopId, packages: [{ orderItems: toPackIds, shipmentProviderId: providerId, trackingCode }] });
          } else {
            await postOrdersPack({ shopId, orderItems: toPackIds.map((id: string) => ({ id, shipmentProviderId: providerId })) });
          }
        }
      } catch {
        // best-effort auto-pack
      }
    }

    if (!vendorItems.length && shopId) {
      try {
        const retry = await getOrderItems({ shopId, orderId: id });
        vendorItems = Array.isArray(retry?.items) ? retry.items : [];
      } catch {
        vendorItems = [];
      }
    }
    if (vendorItems.length) {
      const extractedIds = vendorItems.map(mapOrderItemId).filter(Boolean);
      if (extractedIds.length) {
        orderItemIds = extractedIds;
      }
    }
    if (!orderItemIds.length) {
      return noStoreJson({ ok: false, error: "Unable to locate vendor order items for RTS action", shopId: shopId || undefined }, { status: 400 });
    }

    const result = await postOrdersReadyToShip(shopId ? { shopId, orderItemIds } : { orderItemIds });
    const newStatus =
      result && typeof (result as any)?.status === "string"
        ? String((result as any).status)
        : "READY_TO_SHIP";

    try {
      await prisma.jumiaOrder.update({
        where: { id },
        data: {
          status: newStatus,
          updatedAtJumia: new Date(),
        },
      });
    } catch {
      // best-effort persistence
    }

    return noStoreJson({ ok: true, orderItemIds, result, shopId: shopId || undefined }, { status: 201 });
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
