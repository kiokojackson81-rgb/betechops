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
import { backfillPosReceiptsForCustomerAccount } from "@/lib/posCustomerAccountSync";
import { prisma } from "@/lib/prisma";
import {
  backfillQuoteRequestsForCustomerAccount,
  listCustomerQuoteRequests,
} from "@/lib/quoteRequests";
import { listCustomerSiteVisits } from "@/lib/siteVisits";
import { buildCustomerAccountIdentity, listCustomerAccountOrders } from "@/lib/shopCustomerOrders";

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
  await backfillQuoteRequestsForCustomerAccount({
    userId: user.id,
    phoneVariants: identity.phoneVariants,
    normalizedEmails: identity.normalizedEmails,
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

  const recentOrders = await listCustomerAccountOrders({
    userId: identity.userId,
    phoneVariants: identity.phoneVariants,
    normalizedEmails: identity.normalizedEmails,
    take: 10,
  });
  const recentQuotes = await listCustomerQuoteRequests({
    userId: identity.userId,
    phoneVariants: identity.phoneVariants,
    normalizedEmails: identity.normalizedEmails,
    take: 6,
  });
  const recentSiteVisits = await listCustomerSiteVisits({
    userId: identity.userId,
    phoneVariants: identity.phoneVariants,
    normalizedEmails: identity.normalizedEmails,
    take: 6,
  });

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
              id: order.routeId,
              routeId: order.routeId,
              orderRef: order.orderRef,
              status: order.status,
              total: order.total,
              createdAt: order.createdAt,
              deliveryMethod: order.deliveryMethod,
              customerLocation: order.customerLocation,
              itemsCount: order.itemsCount,
              receiptId: order.receiptId,
              itemPreview: order.itemPreview,
            }))}
            recentQuotes={recentQuotes}
            recentSiteVisits={recentSiteVisits}
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
