import type { Metadata } from "next";
import Link from "next/link";
import { Download, MapPin, Package, ReceiptText } from "lucide-react";
import { getCustomerAccountContext } from "@/app/account/_lib/accountData";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { getCustomerAccountOrderDetail } from "@/lib/shopCustomerOrders";
import { notFound } from "next/navigation";

export const metadata: Metadata = buildShopMetadata({
  title: "Order Details",
  description: "View order details and receipt.",
});
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
const formatStatus = (value: string) =>
  value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolved = await Promise.resolve(params);
  const { identity } = await getCustomerAccountContext();
  const order = await getCustomerAccountOrderDetail({
    routeId: String(resolved.id || ""),
    ...identity,
  });
  if (!order) notFound();
  return (
    <div className="grid w-full min-w-0 gap-4">
      <section className={`${shopStyles.lightCard} p-5 sm:p-7`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className={shopStyles.sectionEyebrow}>Order details</div>
            <h1 className="mt-3 text-2xl font-black sm:text-3xl">
              {order.orderRef}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {formatDate(order.createdAt)} · {order.deliveryMethod} ·{" "}
              {order.itemsCount} items
            </p>
          </div>
          <div className="text-right">
            <span className="rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#7a0000]">
              {formatStatus(order.status)}
            </span>
            <div className="mt-3 text-2xl font-black">
              {formatCurrency(order.total)}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/account/orders" className={shopStyles.secondaryButton}>
            Back to orders
          </Link>
          {order.receiptId ? (
            <a
              href={`/api/receipts/${encodeURIComponent(order.receiptId)}/pdf?download=1`}
              target="_blank"
              rel="noreferrer"
              className={shopStyles.primaryButton}
            >
              <Download className="h-4 w-4" />
              Download receipt
            </a>
          ) : null}
        </div>
      </section>
      <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <div className={`${shopStyles.lightCard} min-w-0 p-5 sm:p-6`}>
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[#7a0000]">
            <Package className="h-4 w-4" />
            Items purchased
          </div>
          <div className="mt-5 overflow-hidden rounded-[20px] border border-[#7a0000]/10">
            {order.items.map((item, index) => (
              <div
                key={item.id}
                className={index ? "border-t border-[#7a0000]/10 p-4" : "p-4"}
              >
                <div className="break-words font-bold">{item.productName}</div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <span>
                    Qty: <b>{item.quantity}</b>
                  </span>
                  <span className="text-right">
                    Unit: <b>{formatCurrency(item.unitPrice)}</b>
                  </span>
                  <span className="text-right">
                    Total: <b>{formatCurrency(item.total)}</b>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid min-w-0 gap-4">
          <section className={`${shopStyles.lightCard} p-5`}>
            <div className="flex items-center gap-2 font-black text-[#7a0000]">
              <ReceiptText className="h-4 w-4" />
              Order summary
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              {[
                ["Customer", order.customerName],
                ["Phone", order.customerPhone || "-"],
                ["Email", order.customerEmail || "-"],
                ["Payment", order.paymentMethod],
                ["Total", formatCurrency(order.total)],
              ].map(([term, value]) => (
                <div key={term} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{term}</dt>
                  <dd className="break-all text-right font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className={`${shopStyles.lightCard} p-5`}>
            <div className="flex items-center gap-2 font-black text-[#7a0000]">
              <MapPin className="h-4 w-4" />
              Delivery and location
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {order.customerLocation}
            </p>
            {order.notes ? (
              <p className="mt-3 text-sm text-slate-600">{order.notes}</p>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
}
