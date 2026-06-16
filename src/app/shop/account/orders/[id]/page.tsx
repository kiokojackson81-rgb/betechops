import type { Metadata } from "next";
import Link from "next/link";
import { Download, MapPin, Package, ReceiptText } from "lucide-react";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import CustomerAccountSidebar from "@/app/shop/_components/CustomerAccountSidebar";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopSupportStrip from "@/app/shop/_components/ShopSupportStrip";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { shopNavLinks } from "@/app/shop/shopData";
import { auth } from "@/lib/auth";
import { findSafeCustomerProfileByUserId } from "@/lib/customerProfile";
import { buildCustomerAccountIdentity, getCustomerAccountOrderDetail } from "@/lib/shopCustomerOrders";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = buildShopMetadata({
  title: "Order Details",
  description: "View customer order details, item pricing, and download your POS receipt from your Betech Solar account.",
});

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatOrderStatus(status: string) {
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export default async function ShopAccountOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams =
    params && typeof (params as Promise<{ id: string }>).then === "function"
      ? await (params as Promise<{ id: string }>)
      : (params as { id: string });
  const routeId = String(resolvedParams?.id || "").trim();

  const session = await auth();
  const user = session?.user as { id?: string | null; phone?: string | null; email?: string | null } | undefined;

  if (!user?.id) {
    redirect(`/login/phone?callbackUrl=${encodeURIComponent(`/account/orders/${routeId}`)}`);
  }

  const dbUser = await findSafeCustomerProfileByUserId(user.id);
  const identity = buildCustomerAccountIdentity(
    {
      id: user.id,
      phone: user.phone || null,
      email: user.email || null,
    },
    dbUser,
  );

  const order = await getCustomerAccountOrderDetail({
    routeId,
    userId: identity.userId,
    phoneVariants: identity.phoneVariants,
    normalizedEmails: identity.normalizedEmails,
  });

  if (!order) {
    notFound();
  }

  const profileCompletionFields = [dbUser?.name, dbUser?.phone, dbUser?.email, dbUser?.county, dbUser?.town];
  const profileCompletion = Math.round(
    (profileCompletionFields.filter((value) => String(value || "").trim()).length / profileCompletionFields.length) * 100,
  );

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-4 sm:py-5">
        <div className={shopStyles.shell}>
          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <CustomerAccountSidebar activeSection="orders" profileCompletion={profileCompletion} />

            <div className="grid gap-4">
              <section className={`${shopStyles.lightCard} p-5 sm:p-6`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className={shopStyles.sectionEyebrow}>Order details</div>
                    <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">{order.orderRef}</h1>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                      <span>{formatDate(order.createdAt)}</span>
                      <span>{order.deliveryMethod}</span>
                      <span>{order.itemsCount} items</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <div className="rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
                      {formatOrderStatus(order.status)}
                    </div>
                    <div className="text-2xl font-black text-slate-950">{formatCurrency(order.total)}</div>
                    <div className="flex flex-wrap gap-3">
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
                  </div>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_0.85fr]">
                <div className={`${shopStyles.lightCard} p-5 sm:p-6`}>
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-[#7a0000]">
                    <Package className="h-4 w-4" />
                    Items purchased
                  </div>
                  <div className="mt-5 overflow-hidden rounded-[20px] border border-[#7a0000]/10">
                    <div className="grid grid-cols-[minmax(0,1.6fr)_80px_120px_120px] gap-3 bg-[#fff7e7] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#7a0000]">
                      <div>Item</div>
                      <div className="text-right">Qty</div>
                      <div className="text-right">Unit price</div>
                      <div className="text-right">Line total</div>
                    </div>
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[minmax(0,1.6fr)_80px_120px_120px] gap-3 border-t border-[#7a0000]/10 px-4 py-4 text-sm text-slate-700"
                      >
                        <div>
                          <div className="font-bold text-slate-950">{item.productName}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {[item.sku, item.category].filter(Boolean).join(" • ") || "POS item"}
                          </div>
                        </div>
                        <div className="text-right font-semibold">{item.quantity}</div>
                        <div className="text-right font-semibold">{formatCurrency(item.unitPrice)}</div>
                        <div className="text-right font-black text-slate-950">{formatCurrency(item.total)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4">
                  <section className={`${shopStyles.lightCard} p-5`}>
                    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-[#7a0000]">
                      <ReceiptText className="h-4 w-4" />
                      Order summary
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <div className="flex items-start justify-between gap-3">
                        <span>Customer</span>
                        <span className="text-right font-semibold text-slate-950">{order.customerName}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span>Phone</span>
                        <span className="text-right font-semibold text-slate-950">{order.customerPhone || "-"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span>Email</span>
                        <span className="text-right font-semibold text-slate-950">{order.customerEmail || "-"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span>Payment method</span>
                        <span className="text-right font-semibold text-slate-950">{order.paymentMethod}</span>
                      </div>
                      {order.receiptNumber ? (
                        <div className="flex items-start justify-between gap-3">
                          <span>Receipt number</span>
                          <span className="text-right font-semibold text-slate-950">{order.receiptNumber}</span>
                        </div>
                      ) : null}
                      <div className="border-t border-[#7a0000]/10 pt-2" />
                      <div className="flex items-start justify-between gap-3">
                        <span>Subtotal</span>
                        <span className="text-right font-semibold text-slate-950">{formatCurrency(order.subtotal)}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span>Total</span>
                        <span className="text-right text-lg font-black text-slate-950">{formatCurrency(order.total)}</span>
                      </div>
                    </div>
                  </section>

                  <section className={`${shopStyles.lightCard} p-5`}>
                    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-[#7a0000]">
                      <MapPin className="h-4 w-4" />
                      Delivery and location
                    </div>
                    <div className="mt-4 text-sm leading-6 text-slate-600">
                      <div className="font-semibold text-slate-950">{order.customerLocation}</div>
                      {order.notes ? <div className="mt-3">{order.notes}</div> : <div className="mt-3">No extra customer note was saved for this order.</div>}
                    </div>
                  </section>
                </div>
              </section>
            </div>
          </div>

          <div className="mt-4">
            <ShopSupportStrip />
          </div>
        </div>
      </section>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}
