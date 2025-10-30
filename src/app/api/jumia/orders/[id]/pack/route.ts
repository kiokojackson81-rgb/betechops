import type { NextRequest } from "next/server";
import { noStoreJson, requireRole } from "@/lib/api";
import { getShipmentProviders, postOrdersPack } from "@/lib/jumia";

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

async function resolveShipmentProviderId(orderItemId: string): Promise<string | null> {
  try {
    const resp = await getShipmentProviders(orderItemId);
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

  let payload = sanitizePayload(body);
  if (!payload) {
    const shipmentProviderId =
      (body && typeof body === "object" && typeof (body as { shipmentProviderId?: unknown }).shipmentProviderId === "string"
        ? ((body as { shipmentProviderId: string }).shipmentProviderId || "").trim()
        : "") || (await resolveShipmentProviderId(id));
    if (!shipmentProviderId) {
      return noStoreJson(
        { ok: false, error: "Unable to determine shipmentProviderId for packing" },
        { status: 400 }
      );
    }
    payload = { orderItems: [{ id, shipmentProviderId }] };
  }

  // Ensure every order item has a shipmentProviderId
  const enriched = await Promise.all(
    payload.orderItems.map(async (item) => {
      if (typeof item.shipmentProviderId === "string" && item.shipmentProviderId.trim()) return item;
      const derived = await resolveShipmentProviderId(item.id);
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
    const result = await postOrdersPack({ orderItems: enriched });
    return noStoreJson({ ok: true, orderItems: enriched, result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return noStoreJson({ ok: false, error: message }, { status: 502 });
  }
}
