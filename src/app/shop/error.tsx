"use client";

import ShopStatePanel from "@/app/shop/_components/ShopStatePanel";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { SHOP_HOME_HREF, SHOP_REQUEST_QUOTE_HREF } from "@/app/shop/storefrontPaths";

export default function ShopError() {
  return (
    <div className={shopStyles.page}>
      <section className="py-10">
        <div className={shopStyles.shell}>
          <ShopStatePanel
            eyebrow="Shop error"
            title="We could not load this Betech Solar page."
            copy="Please try again, continue shopping, or request a solar quote if you need help from the team."
            primaryHref={SHOP_HOME_HREF}
            primaryLabel="Back to Shop"
            secondaryHref={SHOP_REQUEST_QUOTE_HREF}
            secondaryLabel="Request Quote"
          />
        </div>
      </section>
    </div>
  );
}
