import pLimit from 'p-limit';
import { prisma } from '@/lib/prisma';
import { getOrderItems, getShipmentProviders } from '@/lib/jumia';

async function main() {
  const argPersist = process.env.PERSIST === '1' || process.argv.includes('--persist');
  const concurrency = Number(process.env.CONCURRENCY || 4);
  const limit = pLimit(Math.max(1, Math.min(6, concurrency)));

  const shops = await prisma.shop.findMany({
    where: { platform: 'JUMIA', isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const results = await Promise.all(
    shops.map((s) =>
      limit(async () => {
        try {
          const recent = await prisma.jumiaOrder.findFirst({ where: { shopId: s.id }, orderBy: { updatedAt: 'desc' }, select: { id: true } });
          if (!recent) return { shopId: s.id, shopName: s.name, orderId: null, sampleOrderItemId: null, providers: [], error: 'noOrders' };

          const itemsResp = await getOrderItems({ shopId: s.id, orderId: recent.id }).catch(() => ({ items: [] as any[] }));
          const items: any[] = Array.isArray((itemsResp as any)?.items) ? (itemsResp as any).items : [];
          const firstItemId = items.length ? String(items[0]?.id || '') : '';
          if (!firstItemId) return { shopId: s.id, shopName: s.name, orderId: recent.id, sampleOrderItemId: null, providers: [], error: 'noItems' };

          const prov = await getShipmentProviders({ shopId: s.id, orderItemIds: [firstItemId] }).catch(() => ({ providers: [] as any[] }));
          const providersArr: any[] = Array.isArray((prov as any)?.providers)
            ? (prov as any).providers
            : Array.isArray((prov as any)?.orderItems?.[0]?.shipmentProviders)
            ? (prov as any).orderItems[0].shipmentProviders
            : [];
          const providers = providersArr
            .map((p) => ({
              id: String((p?.id ?? p?.providerId ?? p?.code) || ''),
              name: typeof p?.name === 'string' ? p.name : typeof p?.label === 'string' ? p.label : undefined,
              requiresTracking: !!p?.requiredTrackingCode,
            }))
            .filter((p) => p.id);

          if (argPersist && providers.length === 1) {
            try {
              const row = await prisma.config.findUnique({ where: { key: 'jumia:shipper-defaults' } });
              const curr = ((row?.json as any) || {}) as Record<string, { providerId: string; label?: string }>;
              const next = { ...curr, [s.id]: { providerId: providers[0].id, label: providers[0].name || providers[0].id } };
              await prisma.config.upsert({ where: { key: 'jumia:shipper-defaults' }, update: { json: next }, create: { key: 'jumia:shipper-defaults', json: next } });
            } catch {}
          }

          return { shopId: s.id, shopName: s.name, orderId: recent.id, sampleOrderItemId: firstItemId, providers };
        } catch (e: any) {
          return { shopId: s.id, shopName: s.name, orderId: null, sampleOrderItemId: null, providers: [], error: String(e?.message || e) };
        }
      })
    )
  );

  // Print a concise summary
  console.log('Jumia shipping providers by outlet (shop):');
  for (const r of results) {
    const names = r.providers.map((p: any) => `${p.name || p.id}${p.requiresTracking ? ' (tracking)' : ''}`);
    console.log(`- ${r.shopName || r.shopId}: ${names.length ? names.join(', ') : r.error || 'none'}`);
  }

  // Also print JSON for programmatic use
  console.log('\nJSON_RESULT_START');
  console.log(JSON.stringify({ ok: true, results }, null, 2));
  console.log('JSON_RESULT_END');
}

main().finally(async () => {
  try { await prisma.$disconnect(); } catch {}
});
