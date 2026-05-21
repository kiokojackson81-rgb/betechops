import ShopStatePanel from "@/app/shop/_components/ShopStatePanel";
import { shopStyles } from "@/app/shop/_components/shopStyles";

export default function ShopNotFound() {
  return (
    <div className={shopStyles.page}>
      <section className="py-10">
        <div className={shopStyles.shell}>
          <ShopStatePanel
            eyebrow="Product not found"
            title="We could not find that Betech Solar product."
            copy="The product may have moved, or this preview catalogue entry may not be available in the current test dataset."
            primaryHref="/shop"
            primaryLabel="Back to Shop"
            secondaryHref="/shop/request-quote"
            secondaryLabel="Request a Solar Quote"
          />
        </div>
      </section>
    </div>
  );
}
