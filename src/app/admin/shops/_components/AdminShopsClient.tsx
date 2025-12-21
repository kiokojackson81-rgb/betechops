"use client";
import React, { useEffect, useState } from 'react';
import ShopForm from './ShopForm';
import AttendantForm from './AttendantForm';
import ShopsList from './ShopsList';
import { showToast } from '@/lib/ui/toast';
import { ShopsActionsProvider, ShopSummary as ShopSummaryType, ShopsActions } from './ShopsActionsContext';
import { addShopToList, assignUserToShop } from './AdminShopsClient.helpers';

export default function AdminShopsClient({ initial }: { initial: ShopSummaryType[] }) {
  const [shops, setShops] = useState<ShopSummaryType[]>(initial || []);
  const [hydrated, setHydrated] = useState(false);

  // Client-side hydration fallback: if server didn't provide any shops,
  // fetch from the public API to avoid an empty panel in prod after cold deploys.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if ((initial?.length ?? 0) > 0 || hydrated) return;
      try {
        const res = await fetch('/api/shops', { cache: 'no-store' });
        if (!res.ok) return;
        const list = (await res.json()) as Array<{ id: string; name: string; platform?: string | null }>;
        if (!cancelled && Array.isArray(list) && list.length) {
          const mapped: ShopSummaryType[] = list.map((s) => ({ id: s.id, name: s.name, platform: s.platform ?? undefined }));
          setShops(mapped);
          setHydrated(true);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial, hydrated]);

  function onShopCreated(s: ShopSummaryType) {
    setShops(prev => addShopToList(prev, s));
    showToast('Shop created', 'success');
  }

  function onAttendantCreated(user: { id: string; email?: string; name?: string }, assigned?: { shopId?: string; roleAtShop?: string }) {
    setShops(prev => assignUserToShop(prev, user, assigned));
    if (assigned?.shopId) showToast('Attendant assigned', 'success');
  }

  const actions: ShopsActions = {
    onShopCreated: (s: ShopSummaryType) => onShopCreated(s),
    onAttendantCreated: (u: { id: string; email?: string; name?: string }, assigned?: { shopId?: string; roleAtShop?: string }) => onAttendantCreated(u, assigned),
  };

  return (
    <ShopsActionsProvider value={actions}>
      <div className="grid grid-cols-2 gap-6">
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Create Shop</h2>
          <ShopForm />
          <div className="mt-4">
            <h3 className="font-semibold">Create Attendant</h3>
            <AttendantForm shops={shops.map(s => ({ id: s.id, name: s.name }))} />
          </div>
        </div>
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Existing Shops</h2>
          <ShopsList initial={shops} />
        </div>
      </div>
    </ShopsActionsProvider>
  );
}
