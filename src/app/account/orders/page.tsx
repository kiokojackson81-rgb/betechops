import type { Metadata } from "next";
import Link from "next/link";
import { Package, ReceiptText } from "lucide-react";
import { syncCustomerAccountRecords } from "@/app/account/_lib/accountData";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { listCustomerAccountOrders } from "@/lib/shopCustomerOrders";

export const metadata: Metadata = buildShopMetadata({
  title: "Recent Orders",
  description:
    "Review Betech Solar orders and POS receipts linked to your account.",
});
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
const formatStatus = (value: string) =>
  value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default async function AccountOrdersPage() {
  const { identity } = await syncCustomerAccountRecords();
  const orders = await listCustomerAccountOrders({ ...identity, take: 50 });
  return (
    <section className={`${shopStyles.lightCard} w-full min-w-0 p-5 sm:p-7`}>
      <div className="flex items-center gap-3">
        <ReceiptText className="h-7 w-7 text-[#7a0000]" />
        <div>
          <div className={shopStyles.sectionEyebrow}>Recent orders</div>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">
            Orders and POS receipts
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Every purchase linked to your customer identity appears here.
          </p>
        </div>
      </div>
      <div className="mt-6 grid w-full gap-4 2xl:grid-cols-2">
        {orders.length ? (
          orders.map((order) => (
            <article
              key={order.routeId}
              className="min-w-0 rounded-[22px] border border-[#7a0000]/10 bg-[#fcfaf7] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-black">{order.orderRef}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {formatDate(order.createdAt)} · {order.deliveryMethod} ·{" "}
                    {order.itemsCount} items
                  </div>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#7a0000]">
                    {formatStatus(order.status)}
                  </span>
                  <div className="mt-3 text-xl font-black">
                    {formatCurrency(order.total)}
                  </div>
                </div>
              </div>
              {order.itemPreview.length ? (
                <div className="mt-4 space-y-2">
                  {order.itemPreview.map((item, index) => (
                    <div
                      key={`${item.productName}-${index}`}
                      className="flex items-start justify-between gap-3 rounded-[14px] bg-white px-3 py-3 text-sm"
                    >
                      <span className="min-w-0 break-words font-semibold">
                        <Package className="mr-2 inline h-4 w-4 text-[#7a0000]" />
                        {item.productName} × {item.quantity}
                      </span>
                      <span className="shrink-0 font-black">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/account/orders/${encodeURIComponent(order.routeId)}`}
                  className={shopStyles.primaryButton}
                >
                  View order details
                </Link>
                {order.receiptId ? (
                  <a
                    href={`/api/receipts/${encodeURIComponent(order.receiptId)}/pdf?download=1`}
                    target="_blank"
                    rel="noreferrer"
                    className={shopStyles.secondaryButton}
                  >
                    Download receipt
                  </a>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[22px] border border-dashed border-[#7a0000]/15 p-8 text-sm text-slate-500 2xl:col-span-2">
            No website orders or POS receipts are linked to this account yet.
          </div>
        )}
      </div>
    </section>
  );
}
