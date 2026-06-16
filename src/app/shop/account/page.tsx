import type { Metadata } from "next";
import { redirect } from "next/navigation";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import AccountClient from "@/app/shop/_components/AccountClient";
import ShopBreadcrumbs from "@/app/shop/_components/ShopBreadcrumbs";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopSupportStrip from "@/app/shop/_components/ShopSupportStrip";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { shopNavLinks } from "@/app/shop/shopData";
import { SHOP_HOME_HREF } from "@/app/shop/storefrontPaths";
import { auth } from "@/lib/auth";
import { findSafeCustomerProfileByUserId } from "@/lib/customerProfile";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = buildShopMetadata({
  title: "Customer Account",
  description: "Save your Betech Solar customer profile, reuse it in checkout, and review recent orders and quote requests on this device.",
});

export default async function ShopAccountPage() {
  const session = await auth();
  const user = session?.user as { id?: string | null; name?: string | null; phone?: string | null; email?: string | null } | undefined;

  if (!user?.id) {
    redirect("/login/phone?callbackUrl=/account");
  }

  const [dbUser, recentOrders] = await Promise.all([
    findSafeCustomerProfileByUserId(user.id),
    prisma.websiteOrder.findMany({
      where: { customerUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderRef: true,
        status: true,
        total: true,
        createdAt: true,
        deliveryMethod: true,
        customerLocation: true,
        _count: {
          select: {
            items: true,
          },
        },
      },
    }),
  ]);

  const account = dbUser || {
    id: user.id,
    name: user.name || null,
    email: user.email || null,
    phone: user.phone || null,
    whatsappNumber: null,
    county: null,
    town: null,
    estateLandmark: null,
    locationNotes: null,
  };

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-5 sm:py-6">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs items={[{ label: "Shop", href: SHOP_HOME_HREF }, { label: "Account" }]} />
          <div className="mt-3">
            <div className={shopStyles.sectionEyebrow}>Account</div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-[2rem]">Betech Solar customer account</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">
              Review your saved customer details, update your delivery location, and track recent Betech Solar orders from one place.
            </p>
          </div>
          <div className="mt-4 rounded-[1.8rem] border border-[#f2b20f]/20 bg-[linear-gradient(180deg,#fff7e7_0%,#fffdf9_100%)] px-5 py-4 text-sm text-slate-700 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-[#7a0000]">Verified account</div>
            <div className="mt-2 text-base font-semibold text-slate-900">
              {account.name || "Betech customer"} · {account.phone || account.email || "Signed in"}
            </div>
            <div className="mt-1 text-sm text-slate-600">{account.email || "No email saved yet."}</div>
          </div>
          <div className="mt-4">
            <AccountClient
              initialProfile={{
                name: account.name || "",
                email: account.email || "",
                phone: account.phone || "",
                whatsappNumber: account.whatsappNumber || "",
                county: account.county || "",
                town: account.town || "",
                estateLandmark: account.estateLandmark || "",
                locationNotes: account.locationNotes || "",
              }}
              recentOrders={recentOrders.map((order) => ({
                id: order.id,
                orderRef: order.orderRef,
                status: order.status,
                total: Number(order.total),
                createdAt: order.createdAt.toISOString(),
                deliveryMethod: order.deliveryMethod,
                customerLocation: order.customerLocation,
                itemsCount: order._count.items,
              }))}
            />
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
