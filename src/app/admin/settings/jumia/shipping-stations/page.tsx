import { prisma } from '@/lib/prisma';
import ShippingStationsManager from './_components/ShippingStationsManager';

export const dynamic = 'force-dynamic';

export default async function ShippingStationsPage() {
  const shops = await prisma.shop.findMany({
    where: { isActive: true, platform: 'JUMIA' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  }).catch(() => [] as Array<{ id: string; name: string }>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Jumia Shipping Stations</h1>
        <p className="text-slate-300">Set default shipping station per shop and discover providers live from an example order.</p>
      </div>
      <ShippingStationsManager shops={shops} />
    </div>
  );
}
