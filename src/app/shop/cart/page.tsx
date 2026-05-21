import type { Metadata } from "next";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import CartClient from "@/app/shop/_components/CartClient";
import ShopBreadcrumbs from "@/app/shop/_components/ShopBreadcrumbs";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopSupportStrip from "@/app/shop/_components/ShopSupportStrip";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { getShopProducts } from "@/app/shop/shopApi";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { shopNavLinks } from "@/app/shop/shopData";

export const metadata: Metadata = buildShopMetadata({
  title: "Your Cart",
  description: "Review your selected Betech Solar products, update quantities, and continue into the preview checkout flow.",
});

export default async function ShopCartPage() {
  const products = await getShopProducts();

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-8 sm:py-10">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs items={[{ label: "Shop", href: "/shop" }, { label: "Cart" }]} />
          <div className="mt-5">
            <div className={shopStyles.sectionEyebrow}>Cart</div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Your Betech Solar cart</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Review quantities, remove products, continue shopping, or move into the safe preview checkout flow.
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Not sure what you need? Request a solar quote and our team will help size your system.
            </p>
          </div>
          <div className="mt-6">
            <CartClient products={products} />
          </div>
          <div className="mt-6">
            <ShopSupportStrip />
          </div>
        </div>
      </section>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}
