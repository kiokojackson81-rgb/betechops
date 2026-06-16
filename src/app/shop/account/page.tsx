import type { Metadata } from "next";
import { redirect } from "next/navigation";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import AccountClient from "@/app/shop/_components/AccountClient";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopSupportStrip from "@/app/shop/_components/ShopSupportStrip";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { shopNavLinks } from "@/app/shop/shopData";
import { auth } from "@/lib/auth";
import { findSafeCustomerProfileByUserId } from "@/lib/customerProfile";
import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";
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

  const dbUser = await findSafeCustomerProfileByUserId(user.id);
  const normalizedPhone = normalizeKenyanPhone(dbUser?.phone || user.phone || "");
  const phoneVariants = getKenyanPhoneVariants(normalizedPhone);
  const normalizedEmail = String(dbUser?.email || user.email || "").trim().toLowerCase();

  const recentOrders = await prisma.websiteOrder.findMany({
    where: {
      OR: [
        { customerUserId: user.id },
        ...(phoneVariants.length ? [{ customerPhone: { in: phoneVariants } }] : []),
        ...(normalizedEmail ? [{ customerEmail: normalizedEmail }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      orderRef: true,
      status: true,
      total: true,
      createdAt: true,
      deliveryMethod: true,
      customerLocation: true,
      customerPhone: true,
      customerEmail: true,
      customerUserId: true,
      _count: {
        select: {
          items: true,
        },
      },
    },
  });

  if (phoneVariants.length) {
    await prisma.websiteOrder.updateMany({
      where: {
        customerPhone: { in: phoneVariants },
        customerUserId: { not: user.id },
      },
      data: {
        customerUserId: user.id,
      },
    });
  }

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
      <section className="py-4 sm:py-5">
        <div className={shopStyles.shell}>
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
