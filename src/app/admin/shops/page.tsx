import React from 'react';
import ShopForm from './_components/ShopForm';
import AttendantForm from './_components/AttendantForm';
import ShopsList from './_components/ShopsList';
import ApiCredentialsManager from './_components/ApiCredentialsManager';
import { prisma } from '@/lib/prisma';

export default async function Page() {
  type Shop = {
    id: string;
    name: string;
    platform?: string | null;
    userAssignments?: Array<{ user?: { id: string; name?: string | null; email?: string | null }; roleAtShop?: string | null }>;
  };

  let shops: Shop[] = [];
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

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-bold">Shops</h1>
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
          <ShopsList initial={shops.map(s => ({ id: s.id, name: s.name, platform: s.platform ?? undefined, assignedUser: s.userAssignments?.[0]?.user ? { id: s.userAssignments[0].user.id, label: (s.userAssignments[0].user.name ?? s.userAssignments[0].user.email) ?? '', roleAtShop: s.userAssignments?.[0]?.roleAtShop ?? undefined } : undefined }))} />
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
