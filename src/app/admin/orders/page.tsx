import OrdersFilters from './_components/OrdersFilters';
import OrdersTable from './_components/OrdersTable';
import { absUrl, withParams } from '@/lib/abs-url';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Search = {
  status?: string;
  country?: string;
  shopId?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  nextToken?: string;
  size?: string;
};

type Row = {
  id: string;
  number?: string;
  status?: string;
  pendingSince?: string;
  createdAt: string;
  deliveryOption?: string;
  totalItems?: number;
  totalAmountLocal?: { currency: string; value: number };
  country?: { code: string; name: string };
  shopIds?: string[];
};

async function getOrders(params: Search) {
  const base = await absUrl('/api/orders');
  const url = withParams(base, {
    status: params.status,
    country: params.country,
    shopId: params.shopId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    q: params.q,
    nextToken: params.nextToken,
    size: params.size,
  });
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load orders');
  return res.json() as Promise<{
    orders?: Array<Record<string, unknown>>;
    nextToken?: string | null;
    isLastPage?: boolean;
  }>;
}

export default async function OrdersPage(props: unknown) {
  const searchParams: Record<string, string | string[] | undefined> = ((props as { searchParams?: Record<string, string | string[] | undefined> })?.searchParams) || {};
  const toStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const params: Search = {
    status: toStr(searchParams.status),
    country: toStr(searchParams.country),
    shopId: toStr(searchParams.shopId),
    dateFrom: toStr(searchParams.dateFrom),
    dateTo: toStr(searchParams.dateTo),
    q: toStr(searchParams.q),
    nextToken: toStr(searchParams.nextToken),
    size: toStr(searchParams.size),
  };

  // Default window: from system start (earliest Order or Shop), but not older than 3 months
  let usedDefaultFrom = false;
  let usedDefaultTo = false;
  if (!params.dateFrom) {
    try {
      const [firstOrder, firstShop] = await Promise.all([
        prisma.order.findFirst({ select: { createdAt: true }, orderBy: { createdAt: 'asc' } }).catch(() => null),
        prisma.shop.findFirst({ select: { createdAt: true }, orderBy: { createdAt: 'asc' } }).catch(() => null),
      ]);
      const systemStart = firstOrder?.createdAt || firstShop?.createdAt || null;
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const startDate = new Date(Math.max(systemStart ? systemStart.getTime() : 0, threeMonthsAgo.getTime()));
      // If we had neither systemStart nor 3 months ago (shouldn't happen), fall back to 3 months ago anyway
      const iso = isNaN(startDate.getTime()) ? new Date(threeMonthsAgo).toISOString().slice(0, 10) : startDate.toISOString().slice(0, 10);
      params.dateFrom = iso;
      usedDefaultFrom = true;
    } catch {
      const d = new Date(); d.setMonth(d.getMonth() - 3); params.dateFrom = d.toISOString().slice(0, 10); usedDefaultFrom = true;
    }
  }
  // Default dateTo to today to keep the window bounded
  if (!params.dateTo) {
    const today = new Date().toISOString().slice(0, 10);
    params.dateTo = today; usedDefaultTo = true;
  }

  // Load active JUMIA shops for the selector
  const shops = await prisma.shop.findMany({ where: { isActive: true, platform: 'JUMIA' }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  const data = await getOrders(params);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Orders</h1>
        <p className="text-slate-300">Filter by status, country, shop, and date range. Use actions to pack, mark RTS, or print labels.</p>
        {(usedDefaultFrom || usedDefaultTo) && (
          <p className="text-xs text-slate-400 mt-1">Default window: last 3 months, bounded by when the system started. Showing {params.dateFrom} to {params.dateTo}.</p>
        )}
      </div>

      <OrdersFilters shops={shops} />

      <OrdersTable
        rows={(data.orders || []) as unknown as Row[]}
        nextToken={data.nextToken ?? null}
        isLastPage={!!data.isLastPage}
      />
    </div>
  );
}
