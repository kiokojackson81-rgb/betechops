import React from 'react';
import ShopForm from './_components/ShopForm';
import AttendantForm from './_components/AttendantForm';
import ShopsList from './_components/ShopsList';
import ApiCredentialsManager from './_components/ApiCredentialsManager';
import { prisma } from '@/lib/prisma';

export default async function Page() {
  const shops = await prisma.shop.findMany({ orderBy: { createdAt: 'desc' }, include: { userAssignments: { include: { user: true } } } });
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-bold">Shops</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Create Shop</h2>
          <ShopForm onCreatedAction={() => window.location.reload()} />
          <div className="mt-4">
            <h3 className="font-semibold">Create Attendant</h3>
            <AttendantForm shops={shops.map(s => ({ id: s.id, name: s.name }))} onCreatedAction={() => window.location.reload()} />
          </div>
        </div>
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Existing Shops</h2>
          <ShopsList initial={shops.map(s => ({ id: s.id, name: s.name, platform: s.platform, assignedUser: s.userAssignments?.[0]?.user ? { id: s.userAssignments[0].user.id, label: s.userAssignments[0].user.name ?? s.userAssignments[0].user.email, roleAtShop: s.userAssignments?.[0]?.roleAtShop } : undefined }))} />
        </div>
      </div>
      <div className="mt-4 p-4 border rounded">
        <h2 className="font-semibold">API Credentials</h2>
        <ApiCredentialsManager />
      </div>
    </div>
  );
}
// page is a server component that renders the ShopForm and ShopsList (client)
