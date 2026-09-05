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
import { SHOP_CART_HREF, SHOP_HOME_HREF } from "@/app/shop/storefrontPaths";
import { auth } from "@/lib/auth";
import { findSafeCustomerProfileByUserId } from "@/lib/customerProfile";

export const metadata: Metadata = buildShopMetadata({
  title: "Checkout",
  description: "Complete your Betech Solar order with your delivery and payment options.",
});

export default async function ShopCheckoutPage() {
  const session = await auth().catch(() => null);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const [products, customerProfile] = await Promise.all([
    getShopProducts(),
    sessionUserId ? findSafeCustomerProfileByUserId(sessionUserId) : Promise.resolve(null),
  ]);

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-5 sm:py-6">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs items={[{ label: "Shop", href: SHOP_HOME_HREF }, { label: "Cart", href: SHOP_CART_HREF }, { label: "Checkout" }]} />
          <div className="mt-3">
            <div className={shopStyles.sectionEyebrow}>Checkout</div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-[2rem]">Complete Your Betech Solar Order</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">
              Enter your details below and choose your preferred delivery and payment method. Once you submit your order, our team will confirm availability, delivery charges where applicable, and payment details.
            </p>
          </div>
          <div className="mt-4">
            <CheckoutClient
              products={products}
              isSignedIn={Boolean(sessionUserId)}
              initialProfile={{
                fullName: customerProfile?.name || "",
                phoneNumber: customerProfile?.phone || "",
                whatsappNumber: customerProfile?.whatsappNumber || customerProfile?.phone || "",
                email: customerProfile?.email || "",
                county: customerProfile?.county || "",
                town: customerProfile?.town || "",
                estateLandmark: customerProfile?.estateLandmark || "",
                locationNotes: customerProfile?.locationNotes || "",
              }}
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
