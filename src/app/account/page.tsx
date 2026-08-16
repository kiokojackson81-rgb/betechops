import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  MapPin,
  Package,
  UserRound,
  WalletCards,
} from "lucide-react";
import LegacyAccountHashRedirect from "@/app/account/_components/LegacyAccountHashRedirect";
import { syncCustomerAccountRecords } from "@/app/account/_lib/accountData";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { listSerializedLppAccounts } from "@/lib/lipaPolePoleService";
import { listCustomerAccountOrders } from "@/lib/shopCustomerOrders";

export const metadata: Metadata = buildShopMetadata({
  title: "Customer Account",
  description: "Manage your Betech Solar customer account.",
});

export default async function AccountOverviewPage() {
  const context = await syncCustomerAccountRecords();
  const [orders, lppAccounts] = await Promise.all([
    listCustomerAccountOrders({ ...context.identity, take: 3 }),
    listSerializedLppAccounts({ customerId: context.userId, take: 20 }),
  ]);
  const activeLpp = lppAccounts.filter(
    (account) =>
      !["COMPLETED", "CANCELLED", "REFUNDED", "CLOSED"].includes(
        account.status,
      ),
  );
  const location = [context.profile.town, context.profile.county]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="grid w-full min-w-0 gap-4">
      <LegacyAccountHashRedirect />
      <section className="grid gap-4 lg:grid-cols-3">
        <div className={`${shopStyles.lightCard} p-5`}>
          <UserRound className="h-5 w-5 text-[#7a0000]" />
          <div className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">
            Account details
          </div>
          <div className="mt-2 text-xl font-black">
            {context.profile.name || "Betech customer"}
          </div>
          <div className="mt-2 break-words text-sm text-slate-600">
            {context.profile.email || context.profile.phone}
          </div>
        </div>
        <div className={`${shopStyles.lightCard} p-5`}>
          <MapPin className="h-5 w-5 text-[#7a0000]" />
          <div className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">
            Delivery address
          </div>
          <div className="mt-2 text-xl font-black">
            {location || "Not added"}
          </div>
          <Link
            href="/account/address"
            className="mt-3 inline-flex text-sm font-bold text-[#7a0000]"
          >
            Manage address
          </Link>
        </div>
        <div className={`${shopStyles.lightCard} p-5`}>
          <CheckCircle2 className="h-5 w-5 text-[#0f9d58]" />
          <div className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">
            Account status
          </div>
          <div className="mt-2 text-xl font-black">Verified customer</div>
          <div className="mt-2 text-sm text-slate-600">
            {context.profileCompletion}% profile complete
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={`${shopStyles.lightCard} min-w-0 p-5 sm:p-6`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className={shopStyles.sectionEyebrow}>Recent orders</div>
              <h2 className="mt-3 text-xl font-black">Latest purchases</h2>
            </div>
            <Package className="h-6 w-6 text-[#7a0000]" />
          </div>
          <div className="mt-5 space-y-3">
            {orders.length ? (
              orders.map((order) => (
                <Link
                  key={order.routeId}
                  href={`/account/orders/${encodeURIComponent(order.routeId)}`}
                  className="flex items-center justify-between gap-4 rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-black">
                      {order.orderRef}
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">
                      {order.itemsCount} item{order.itemsCount === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="shrink-0 font-black">
                    {formatCurrency(order.total)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No orders are linked to this account yet.
              </p>
            )}
          </div>
          <Link
            href="/account/orders"
            className={`${shopStyles.secondaryButton} mt-5`}
          >
            View all orders
          </Link>
        </div>
        <div className={`${shopStyles.softCard} min-w-0 p-5 sm:p-6`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className={shopStyles.sectionEyebrow}>Lipa Pole Pole</div>
              <h2 className="mt-3 text-xl font-black">Payment plans</h2>
            </div>
            <WalletCards className="h-6 w-6 text-[#7a0000]" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] bg-white p-4">
              <div className="text-xs font-bold text-slate-500">
                Active plans
              </div>
              <div className="mt-1 text-2xl font-black">{activeLpp.length}</div>
            </div>
            <div className="rounded-[18px] bg-white p-4">
              <div className="text-xs font-bold text-slate-500">
                Outstanding
              </div>
              <div className="mt-1 text-2xl font-black">
                {formatCurrency(
                  activeLpp.reduce((sum, account) => sum + account.balance, 0),
                )}
              </div>
            </div>
          </div>
          <Link
            href="/account/lipa-pole-pole"
            className={`${shopStyles.primaryButton} mt-5`}
          >
            Open Lipa Pole Pole
          </Link>
        </div>
      </section>
    </div>
  );
}
