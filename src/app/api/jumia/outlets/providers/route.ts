import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { requireRole, noStoreJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getOrderItems, getShipmentProviders } from "@/lib/jumia";

type ProviderOut = { id: string; name?: string; requiresTracking?: boolean };
type ShopProviders = {
  shopId: string;
  shopName?: string | null;
  orderId?: string | null;
  sampleOrderItemId?: string | null;
  providers: ProviderOut[];
  singleProvider: boolean;
  error?: string;
};

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const persist = url.searchParams.get("persist") === "1";
  const concurrency = Math.max(1, Math.min(5, Number(url.searchParams.get("concurrency") || 3)));

  try {
    const shops = await prisma.shop.findMany({
      where: { platform: "JUMIA", isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    const limit = pLimit(concurrency);
    const results = await Promise.all(
      shops.map((s) =>
        limit(async (): Promise<ShopProviders> => {
          try {
            const recent = await prisma.jumiaOrder
              .findFirst({ where: { shopId: s.id }, orderBy: { updatedAt: "desc" }, select: { id: true } })
              .catch(() => null);
            if (!recent) {
              return { shopId: s.id, shopName: s.name, orderId: null, sampleOrderItemId: null, providers: [], singleProvider: false, error: "noOrders" };
            }

            const itemsResp = await getOrderItems({ shopId: s.id, orderId: recent.id }).catch(() => ({ items: [] as any[] }));
            const items: any[] = Array.isArray((itemsResp as any)?.items) ? (itemsResp as any).items : [];
            const firstItemId = items.length ? String(items[0]?.id || "") : "";
            if (!firstItemId) {
              return { shopId: s.id, shopName: s.name, orderId: recent.id, sampleOrderItemId: null, providers: [], singleProvider: false, error: "noItems" };
            }

            const prov = await getShipmentProviders({ shopId: s.id, orderItemIds: [firstItemId] }).catch(() => ({ providers: [] as any[] }));
            const providersArr: any[] = Array.isArray((prov as any)?.providers)
              ? (prov as any).providers
              : Array.isArray((prov as any)?.orderItems?.[0]?.shipmentProviders)
              ? (prov as any).orderItems[0].shipmentProviders
              : [];
            const providers: ProviderOut[] = providersArr.map((p) => ({
              id: String((p?.id ?? p?.providerId ?? p?.code) || ""),
              name: typeof p?.name === "string" ? p.name : typeof p?.label === "string" ? p.label : undefined,
              requiresTracking: !!p?.requiredTrackingCode,
            })).filter((p) => p.id);

            // Optionally persist a single provider default for this shop
            if (persist && providers.length === 1) {
              try {
                const row = await prisma.config.findUnique({ where: { key: "jumia:shipper-defaults" } });
                const curr = ((row?.json as any) || {}) as Record<string, { providerId: string; label?: string }>;
                const next = { ...curr, [s.id]: { providerId: providers[0].id, label: providers[0].name || providers[0].id } };
                await prisma.config.upsert({ where: { key: "jumia:shipper-defaults" }, update: { json: next }, create: { key: "jumia:shipper-defaults", json: next } });
              } catch {}
            }

            return {
              shopId: s.id,
              shopName: s.name,
              orderId: recent.id,
              sampleOrderItemId: firstItemId,
              providers,
              singleProvider: providers.length === 1,
            };
          } catch (e: unknown) {
            return { shopId: s.id, shopName: s.name, orderId: null, sampleOrderItemId: null, providers: [], singleProvider: false, error: String(e instanceof Error ? e.message : e) };
          }
        })
      )
    );

    return noStoreJson({ ok: true, persistApplied: persist, results });
  } catch (e: unknown) {
    return noStoreJson({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
