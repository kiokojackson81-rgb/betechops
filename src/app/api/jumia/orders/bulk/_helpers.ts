import { prisma } from '@/lib/prisma';
import {
  getOrderItems,
  getShipmentProviders,
  postOrdersPackV2,
  postOrdersReadyToShip,
  postOrdersPrintLabels,
} from '@/lib/jumia';

type DefaultsMap = Record<string, { providerId: string; label?: string }>;

export async function loadDefaultProviders(): Promise<DefaultsMap> {
  const row = await prisma.config.findUnique({ where: { key: 'jumia:shipper-defaults' } }).catch(() => null);
  return ((row?.json ?? {}) as DefaultsMap) || {};
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function fallbackTrackingCode(base: string) {
  const ts = Date.now();
  return `AUTO-${base}-${ts}`.slice(0, 32);
}

export async function resolvePackPackagesForOrders(opts: {
  shopId: string;
  orderIds: string[];
  defaultProviders: DefaultsMap;
  maxItems?: number;
}) {
  const { shopId, orderIds, defaultProviders } = opts;
  const maxItems = opts.maxItems ?? 500;
  const packages: Array<{
    orderNumber: string;
    shipmentProviderId: string;
    trackingCode?: string;
    orderItems: Array<{ id: string }>;
  }> = [];

  for (const orderId of orderIds) {
    const items = await getOrderItems({ shopId, orderId }).catch(() => [] as any[]);
    const pendingItems = (items || []).filter((it: any) => (it?.status || '').toUpperCase() === 'PENDING');
    if (pendingItems.length === 0) continue;

    // pick provider: default for shop or from provider list for first item
    let shipmentProviderId = defaultProviders[shopId]?.providerId;
    let trackingCode: string | undefined;
    if (!shipmentProviderId || shipmentProviderId === 'auto') {
      const prov = await getShipmentProviders({ shopId, orderItemIds: [pendingItems[0].id] }).catch(() => ({ providers: [] as any[] }));
      const provider = (prov?.providers || []).find((p: any) => !p?.requiredTrackingCode) || (prov?.providers || [])[0];
      if (!provider) continue;
      shipmentProviderId = provider.id;
      if (provider.requiredTrackingCode) trackingCode = fallbackTrackingCode(pendingItems[0].id.slice(0, 8));
    }

    const picked = pendingItems.slice(0, Math.max(1, Math.floor(maxItems / orderIds.length)));
    packages.push({
      orderNumber: orderId,
      shipmentProviderId,
      trackingCode,
      orderItems: picked.map((it: any) => ({ id: it.id })),
    });
  }

  return packages;
}

export async function collectOrderItemIdsByStatus(opts: {
  shopId: string;
  orderIds: string[];
  includeStatuses: string[]; // item-level statuses
  max?: number;
}) {
  const { shopId, orderIds, includeStatuses } = opts;
  const max = opts.max ?? 1000;
  const want = new Set(includeStatuses.map((s) => s.toUpperCase()));
  const out: string[] = [];
  for (const orderId of orderIds) {
    if (out.length >= max) break;
    const items = await getOrderItems({ shopId, orderId }).catch(() => [] as any[]);
    for (const it of items || []) {
      const st = String(it?.status || '').toUpperCase();
      if (want.has(st)) {
        out.push(it.id);
        if (out.length >= max) break;
      }
    }
  }
  return out;
}

export async function packWithV2(shopId: string, packages: any[]) {
  if (!packages.length) return { ok: true, packages: 0, result: [] } as const;
  const result = await postOrdersPackV2({ shopId, packages });
  return { ok: true, packages: packages.length, result } as const;
}

export async function readyToShip(shopId: string, orderItemIds: string[]) {
  if (!orderItemIds.length) return { ok: true, items: 0 } as const;
  const batches = chunk(orderItemIds, 180);
  const results: any[] = [];
  for (const ids of batches) {
    const r = await postOrdersReadyToShip({ shopId, orderItemIds: ids });
    results.push(r);
  }
  return { ok: true, items: orderItemIds.length, result: results } as const;
}

export async function printLabels(shopId: string, orderItemIds: string[], includeLabels = false) {
  if (!orderItemIds.length) return { ok: true, items: 0, labels: [] as any[] } as const;
  const batches = chunk(orderItemIds, 120);
  const allLabels: any[] = [];
  for (const ids of batches) {
    const r = await postOrdersPrintLabels({ shopId, orderItemIds: ids });
    const labels = (r?.labels || []).map((x: any) => (includeLabels ? x : { trackingNumber: x.trackingNumber }));
    allLabels.push(...labels);
  }
  return { ok: true, items: orderItemIds.length, labels: allLabels } as const;
}
