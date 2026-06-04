import ShopStatePanel from "@/app/shop/_components/ShopStatePanel";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { SHOP_HOME_HREF, SHOP_REQUEST_QUOTE_HREF } from "@/app/shop/storefrontPaths";

export default function ShopNotFound() {
  return (
    <div className={shopStyles.page}>
      <section className="py-10">
        <div className={shopStyles.shell}>
          <ShopStatePanel
            eyebrow="Product not found"
            title="We could not find that Betech Solar product."
            copy="The product may have moved, or it may not be available in the current Betech Solar catalogue."
            primaryHref={SHOP_HOME_HREF}
            primaryLabel="Back to Shop"
            secondaryHref={SHOP_REQUEST_QUOTE_HREF}
            secondaryLabel="Request a Solar Quote"
          />
        </div>
      </section>
    </div>
  );
}
