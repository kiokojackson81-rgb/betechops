import React from 'react';
import ShopForm from './_components/ShopForm';
import ShopsList from './_components/ShopsList';
import { prisma } from '@/lib/prisma';

export default async function Page() {
  const shops = await prisma.shop.findMany({ orderBy: { createdAt: 'desc' } });
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-bold">Shops</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Create Shop</h2>
          <ShopForm onCreatedAction={(s: unknown) => window.location.reload()} />
        </div>
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Existing Shops</h2>
          <ShopsList initial={shops} />
        </div>
      </div>
    </div>
  );
}
// page is a server component that renders the ShopForm and ShopsList (client)
