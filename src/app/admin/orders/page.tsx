import OrdersFilters from './_components/OrdersFilters';
import OrdersTable from './_components/OrdersTable';
import { absUrl, withParams } from '@/lib/abs-url';

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

  const data = await getOrders(params);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Orders</h1>
        <p className="text-slate-300">Filter by status, country, shop, and date range. Use actions to pack, mark RTS, or print labels.</p>
      </div>

      <OrdersFilters />

      <OrdersTable
        rows={(data.orders || []) as unknown as Row[]}
        nextToken={data.nextToken ?? null}
        isLastPage={!!data.isLastPage}
      />
    </div>
  );
}
