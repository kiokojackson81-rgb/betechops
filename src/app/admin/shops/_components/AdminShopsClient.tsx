"use client";
import React, { useState } from 'react';
import ShopForm from './ShopForm';
import AttendantForm from './AttendantForm';
import ShopsList from './ShopsList';
import { showToast } from '@/lib/ui/toast';
import { ShopsActionsProvider, ShopSummary as ShopSummaryType, ShopsActions } from './ShopsActionsContext';

type ShopSummary = { id: string; name: string; platform?: string; assignedUser?: { id: string; label: string; roleAtShop?: string } };

export function addShopToList(prev: ShopSummary[], s: ShopSummary): ShopSummary[] {
  return [s, ...prev];
}

export function assignUserToShop(prev: ShopSummary[], user: { id: string; email?: string; name?: string }, assigned?: { shopId?: string; roleAtShop?: string }): ShopSummary[] {
  if (!assigned?.shopId) return prev;
  return prev.map(p => p.id === assigned.shopId ? { ...p, assignedUser: { id: user.id, label: user.name ?? user.email ?? '', roleAtShop: assigned.roleAtShop } } : p);
}

export default function AdminShopsClient({ initial }: { initial: ShopSummary[] }) {
  const [shops, setShops] = useState<ShopSummary[]>(initial || []);

  function onShopCreated(s: ShopSummary) {
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
