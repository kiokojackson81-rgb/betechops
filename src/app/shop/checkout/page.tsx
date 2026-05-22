import type { Metadata } from "next";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import CheckoutClient from "@/app/shop/_components/CheckoutClient";
import ShopSupportStrip from "@/app/shop/_components/ShopSupportStrip";
import ShopBreadcrumbs from "@/app/shop/_components/ShopBreadcrumbs";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { getShopProducts } from "@/app/shop/shopApi";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { shopNavLinks } from "@/app/shop/shopData";

export const metadata: Metadata = buildShopMetadata({
  title: "Checkout Preview",
  description: "Submit a preview Betech Solar order with delivery and payment preferences before live ops integration goes online.",
});

export default async function ShopCheckoutPage() {
  const products = await getShopProducts();

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-5 sm:py-6">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs items={[{ label: "Shop", href: "/shop" }, { label: "Cart", href: "/shop/cart" }, { label: "Checkout" }]} />
          <div className="mt-3">
            <div className={shopStyles.sectionEyebrow}>Checkout</div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-[2rem]">Preview checkout for Betech Solar Online Store</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">
              This flow collects customer, delivery, and payment preference details, but does not create a live POS record or process payment automatically yet.
            </p>
          </div>
          <div className="mt-4">
            <CheckoutClient products={products} />
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
