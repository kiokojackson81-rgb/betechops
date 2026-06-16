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
import { backfillPosReceiptsForCustomerAccount } from "@/lib/posCustomerAccountSync";
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
  const normalizedPhones = Array.from(
    new Set([dbUser?.phone, user.phone].map((value) => normalizeKenyanPhone(value || "")).filter(Boolean)),
  );
  const phoneVariants = Array.from(
    new Set(normalizedPhones.flatMap((value) => getKenyanPhoneVariants(value))),
  );
  const normalizedEmails = Array.from(
    new Set([dbUser?.email, user.email].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)),
  );

  await backfillPosReceiptsForCustomerAccount({
    phoneVariants,
    normalizedEmails,
    limit: 100,
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

  const recentOrders = await prisma.websiteOrder.findMany({
    where: {
      OR: [
        { customerUserId: user.id },
        ...(phoneVariants.length ? [{ customerPhone: { in: phoneVariants } }] : []),
        ...(normalizedEmails.length ? [{ customerEmail: { in: normalizedEmails } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      orderRef: true,
      receiptId: true,
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

  const fallbackReceipts = await prisma.receipt.findMany({
    where: {
      order: {
        OR: [
          ...(phoneVariants.length ? [{ customerPhone: { in: phoneVariants } }] : []),
          ...(normalizedEmails.length ? [{ customerEmail: { in: normalizedEmails } }] : []),
        ],
      },
    },
    orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: {
      id: true,
      receiptNumber: true,
      generatedAt: true,
      createdAt: true,
      order: {
        select: {
          orderNumber: true,
          totalAmount: true,
          metadata: true,
          items: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  const recentOrderRows = [
    ...recentOrders.map((order) => ({
      id: order.id,
      orderRef: order.orderRef,
      status: order.status,
      total: Number(order.total),
      createdAt: order.createdAt.toISOString(),
      deliveryMethod: order.deliveryMethod,
      customerLocation: order.customerLocation,
      itemsCount: order._count.items,
      receiptId: order.receiptId,
    })),
    ...fallbackReceipts
      .filter((receipt) => {
        const orderRef = receipt.order?.orderNumber || receipt.receiptNumber || receipt.id;
        return !recentOrders.some(
          (order) => order.receiptId === receipt.id || order.orderRef === orderRef,
        );
      })
      .map((receipt) => {
        const metadata =
          receipt.order?.metadata && typeof receipt.order.metadata === "object" && !Array.isArray(receipt.order.metadata)
            ? (receipt.order.metadata as Record<string, unknown>)
            : {};
        const deliveryMethod =
          typeof metadata.customerType === "string" && metadata.customerType === "pod"
            ? "POS Pay on Delivery"
            : metadata.deliveryAddress
              ? "POS Delivery"
              : "POS Walk-in";
        const customerLocation =
          typeof metadata.deliveryAddress === "string" && metadata.deliveryAddress.trim()
            ? metadata.deliveryAddress.trim()
            : "Betech POS customer";

        return {
          id: `receipt-${receipt.id}`,
          orderRef: receipt.order?.orderNumber || receipt.receiptNumber || receipt.id,
          status: "DELIVERED",
          total: Number(receipt.order?.totalAmount || 0),
          createdAt: (receipt.generatedAt || receipt.createdAt).toISOString(),
          deliveryMethod,
          customerLocation,
          itemsCount: receipt.order?.items.length || 0,
          receiptId: receipt.id,
        };
      }),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

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
            recentOrders={recentOrderRows.map((order) => ({
              id: order.id,
              orderRef: order.orderRef,
              status: order.status,
              total: order.total,
              createdAt: order.createdAt,
              deliveryMethod: order.deliveryMethod,
              customerLocation: order.customerLocation,
              itemsCount: order.itemsCount,
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
