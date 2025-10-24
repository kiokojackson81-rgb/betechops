"use client";
import React, { useState } from 'react';
import ShopForm from './ShopForm';
import AttendantForm from './AttendantForm';
import ShopsList from './ShopsList';
import { showToast } from '@/lib/ui/toast';

type ShopSummary = { id: string; name: string; platform?: string; assignedUser?: { id: string; label: string; roleAtShop?: string } };

export default function AdminShopsClient({ initial }: { initial: ShopSummary[] }) {
  const [shops, setShops] = useState<ShopSummary[]>(initial || []);

  function onShopCreated(s: ShopSummary) {
    // prepend new shop
    setShops(prev => [s, ...prev]);
    showToast('Shop created', 'success');
  }

  function onAttendantCreated(user: { id: string; email?: string; name?: string }, assigned?: { shopId?: string; roleAtShop?: string }) {
    if (assigned?.shopId) {
      setShops(prev => prev.map(p => p.id === assigned.shopId ? { ...p, assignedUser: { id: user.id, label: user.name ?? user.email ?? '', roleAtShop: assigned.roleAtShop } } : p));
      showToast('Attendant assigned', 'success');
    }
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="p-4 border rounded">
        <h2 className="font-semibold">Create Shop</h2>
  <ShopForm onCreatedAction={(j: { id: string; name: string; platform?: string }) => onShopCreated({ id: j.id, name: j.name, platform: j.platform ?? undefined })} />
        <div className="mt-4">
          <h3 className="font-semibold">Create Attendant</h3>
          <AttendantForm shops={shops.map(s => ({ id: s.id, name: s.name }))} onCreatedAction={(u: { id: string; email?: string; name?: string }, assigned?: { shopId?: string; roleAtShop?: string }) => onAttendantCreated(u, assigned)} />
        </div>
      </div>
      <div className="p-4 border rounded">
        <h2 className="font-semibold">Existing Shops</h2>
        <ShopsList initial={shops} />
      </div>
    </div>
  );
}
