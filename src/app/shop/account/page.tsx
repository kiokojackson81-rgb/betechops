import type { Metadata } from "next";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import AccountClient from "@/app/shop/_components/AccountClient";
import ShopBreadcrumbs from "@/app/shop/_components/ShopBreadcrumbs";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopSupportStrip from "@/app/shop/_components/ShopSupportStrip";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { shopNavLinks } from "@/app/shop/shopData";

export const metadata: Metadata = buildShopMetadata({
  title: "Customer Account",
  description: "Save your Betech Solar customer profile, reuse it in checkout, and review recent orders and quote requests on this device.",
});

export default function ShopAccountPage() {
  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-5 sm:py-6">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs items={[{ label: "Shop", href: "/shop" }, { label: "Account" }]} />
          <div className="mt-3">
            <div className={shopStyles.sectionEyebrow}>Account</div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-[2rem]">Betech Solar customer account</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">
              Save your customer profile on this device, reuse it during checkout, and review recent orders and quote requests.
            </p>
          </div>
          <div className="mt-4">
            <AccountClient />
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
