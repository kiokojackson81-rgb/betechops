import type { Metadata } from "next";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import OrderSuccessClient from "@/app/shop/_components/OrderSuccessClient";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { shopNavLinks } from "@/app/shop/shopData";

export const metadata: Metadata = buildShopMetadata({
  title: "Order Confirmation Preview",
  description: "Review your Betech Solar preview order reference, selected products, and confirmation status during customer testing.",
});

export default async function ShopOrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; mode?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-12 sm:py-16">
        <div className={shopStyles.shell}>
          <OrderSuccessClient orderRef={params.ref} mode={params.mode} />
        </div>
      </section>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}
