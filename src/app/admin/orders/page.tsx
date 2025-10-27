import OrdersFilters from './_components/OrdersFilters';
import OrdersTable from './_components/OrdersTable';

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
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && qs.append(k, v));
  const res = await fetch(`/api/orders?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load orders');
  return res.json() as Promise<{
    orders?: Array<Record<string, unknown>>;
    nextToken?: string | null;
    isLastPage?: boolean;
  }>;
}

export default async function OrdersPage({ searchParams }: { searchParams: Search }) {
  const data = await getOrders(searchParams);

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
