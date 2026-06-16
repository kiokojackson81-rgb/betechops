import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
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
import { backfillPosReceiptsForCustomerAccount } from "@/lib/posCustomerAccountSync";
import { prisma } from "@/lib/prisma";
import { buildCustomerAccountIdentity, listCustomerAccountOrders } from "@/lib/shopCustomerOrders";
import { redirect } from "next/navigation";

export const metadata: Metadata = buildShopMetadata({
  title: "Recent Orders",
  description: "Review all recent Betech Solar customer orders and POS receipts linked to your account.",
});

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatOrderStatus(status: string) {
  if (status === "COMPLETE") return "Complete";
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

const compactItemNameStyle = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: 4,
  overflow: "hidden",
};

export default async function ShopAccountOrdersPage() {
  const session = await auth();
  const user = session?.user as { id?: string | null; phone?: string | null; email?: string | null } | undefined;

  if (!user?.id) {
    redirect("/login/phone?callbackUrl=/account/orders");
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

  await backfillPosReceiptsForCustomerAccount({
    phoneVariants: identity.phoneVariants,
    normalizedEmails: identity.normalizedEmails,
    limit: 100,
  });

  if (identity.phoneVariants.length) {
    await prisma.websiteOrder.updateMany({
      where: {
        customerPhone: { in: identity.phoneVariants },
        customerUserId: { not: user.id },
      },
      data: {
        customerUserId: user.id,
      },
    });
  }

  const orders = await listCustomerAccountOrders({
    userId: identity.userId,
    phoneVariants: identity.phoneVariants,
    normalizedEmails: identity.normalizedEmails,
    take: 50,
  });

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
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className={shopStyles.sectionEyebrow}>Customer orders</div>
                    <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">All recent orders linked to your account</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                      POS receipts and website checkout orders tied to your verified phone number or email will appear here.
                    </p>
                  </div>
                  <Link href="/account" className={shopStyles.secondaryButton}>
                    Back to account
                  </Link>
                </div>
              </section>

              <section className={`${shopStyles.lightCard} p-5 sm:p-6`}>
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-[#7a0000]">
                  <ReceiptText className="h-4 w-4" />
                  Order history
                </div>

                <div className="mt-5 space-y-4">
                  {orders.length ? (
                    orders.map((order) => (
                      <div key={order.routeId} className="rounded-[22px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4 sm:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-lg font-black text-slate-950">{order.orderRef}</div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                              <span>{formatDate(order.createdAt)}</span>
                              <span>{order.deliveryMethod}</span>
                              <span>{order.itemsCount} items</span>
                            </div>
                            {order.itemPreview.length ? (
                              <div className="mt-3 overflow-hidden rounded-[16px] border border-[#7a0000]/10 bg-white">
                                <div className="grid grid-cols-[minmax(0,1.4fr)_60px_110px_110px] gap-2 bg-[#fff7e7] px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
                                  <div>Item</div>
                                  <div className="text-right">Qty</div>
                                  <div className="text-right">Unit price</div>
                                  <div className="text-right">Line total</div>
                                </div>
                                {order.itemPreview.map((item, index) => (
                                  <div
                                    key={`${order.routeId}-${item.productName}-${index}`}
                                    className="grid grid-cols-[minmax(0,1.4fr)_60px_110px_110px] gap-2 border-t border-[#7a0000]/10 px-3 py-3 text-sm text-slate-700"
                                  >
                                    <div>
                                      <div
                                        className="font-bold leading-7 text-slate-950 break-words"
                                        style={compactItemNameStyle}
                                        title={item.productName}
                                      >
                                        {item.productName}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-500">
                                        {[item.sku, item.category].filter(Boolean).join(" • ") || order.customerLocation}
                                      </div>
                                    </div>
                                    <div className="text-right">{item.quantity}</div>
                                    <div className="text-right">{formatCurrency(item.unitPrice)}</div>
                                    <div className="text-right font-black text-slate-950">{formatCurrency(item.total)}</div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-2 text-sm text-slate-500">{order.customerLocation}</div>
                            )}
                          </div>
                          <div className="flex flex-col items-start gap-3 lg:items-end">
                            <div className="rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
                              {formatOrderStatus(order.status)}
                            </div>
                            <div className="text-2xl font-black text-slate-950">{formatCurrency(order.total)}</div>
                            <div className="flex flex-nowrap items-center gap-3 overflow-x-auto">
                              <Link
                                href={`/account/orders/${encodeURIComponent(order.routeId)}`}
                                className={`${shopStyles.secondaryButton} whitespace-nowrap`}
                              >
                                View order details
                              </Link>
                              {order.receiptId ? (
                                <a
                                  href={`/api/receipts/${encodeURIComponent(order.receiptId)}/pdf?download=1`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`${shopStyles.secondaryButton} whitespace-nowrap`}
                                >
                                  Download receipt
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-[#7a0000]/15 bg-[#fcfaf7] p-6 text-sm text-slate-500">
                      No recent website orders or POS receipts are linked to this customer account yet.
                    </div>
                  )}
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
