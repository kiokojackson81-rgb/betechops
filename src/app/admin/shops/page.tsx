import React from 'react';
import { absUrl } from '@/lib/abs-url';
import ApiCredentialsManager from './_components/ApiCredentialsManager';
import AdminShopsClient from './_components/AdminShopsClient';
import SyncedShopsList from './_components/SyncedShopsList';
import { prisma } from '@/lib/prisma';

export default async function Page() {
  type Shop = {
    id: string;
    name: string;
    platform?: string | null;
    userAssignments?: Array<{ user?: { id: string; name?: string | null; email?: string | null }; roleAtShop?: string | null }>;
  };

  let shops: Shop[] = [];
  let syncedShops: Array<{ id: string; name: string; account: { label: string | null } | null; lastOrdersUpdatedBefore: Date | null; updatedAt: Date | null }> = [];
  try {
    shops = await prisma.shop.findMany({ orderBy: { createdAt: 'desc' }, include: { userAssignments: { include: { user: true } } } });
  } catch (e) {
    // Do not throw — render a friendly inline message so the admin layout stays usable
    // This protects against transient DB/network issues or when migrations are not applied.
    // The full error will be in server logs.
    console.error('Admin shops page prisma error:', e);
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-xl font-bold">Shops</h1>
        <div className="p-4 border rounded bg-yellow-900/10">
          <h2 className="font-semibold">Database unavailable</h2>
          <p className="text-slate-300 mt-2">
            The application cannot reach the database or required migrations are not applied. Please check your
            <span className="font-medium"> Database URL </span> and run Prisma migrations. See Admin → Health Checks for details.
          </p>
        </div>
        <div className="mt-4 p-4 border rounded">
          <h2 className="font-semibold">API Credentials</h2>
          <ApiCredentialsManager />
        </div>
      </div>
    );
  }

  try {
    syncedShops = await prisma.jumiaShop.findMany({
      select: {
        id: true,
        name: true,
        account: { select: { label: true } },
        lastOrdersUpdatedBefore: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    console.error('Admin shops page jumiaShop error:', error);
    syncedShops = [];
  }

  // Server-side fallback: if no shops returned (fresh prod DB, stale ISR), try API fetch
  if (!shops || shops.length === 0) {
    try {
      const url = await absUrl('/api/shops');
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) {
        const list = await r.json();
        if (Array.isArray(list) && list.length) {
          shops = list.map((s: any) => ({ id: String(s.id), name: String(s.name ?? ''), platform: s.platform ?? undefined }));
        }
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-bold">Shops</h1>
      <div>
        {/* Client wrapper handles shop creation, attendant creation and in-place updates */}
        <AdminShopsClient initial={shops.map(s => ({ id: s.id, name: s.name, platform: s.platform ?? undefined, assignedUser: s.userAssignments?.[0]?.user ? { id: s.userAssignments[0].user.id, label: (s.userAssignments[0].user.name ?? s.userAssignments[0].user.email) ?? '', roleAtShop: s.userAssignments?.[0]?.roleAtShop ?? undefined } : undefined }))} />
      </div>
      {syncedShops.length > 0 && (
        <div className="mt-4 p-4 border rounded">
          <h2 className="font-semibold">Synced Jumia Shops</h2>
          <p className="text-xs text-slate-400 mt-1">
            These entries come from the new Jumia account directory and are read-only today.
          </p>
          <div className="mt-3">
            <SyncedShopsList
              shops={syncedShops.map((shop) => ({
                id: shop.id,
                name: shop.name,
                accountLabel: shop.account?.label ?? null,
                lastOrdersUpdatedBefore: shop.lastOrdersUpdatedBefore ? shop.lastOrdersUpdatedBefore.toISOString() : null,
                updatedAt: shop.updatedAt ? shop.updatedAt.toISOString() : null,
              }))}
            />
          </div>
        </div>
      )}
      <div className="mt-4 p-4 border rounded">
        <h2 className="font-semibold">API Credentials</h2>
        <ApiCredentialsManager />
      </div>
    </div>
  );
}
// page is a server component that renders the ShopForm and ShopsList (client)
