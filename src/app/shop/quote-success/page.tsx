import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import QuoteSuccessClient from "@/app/shop/_components/QuoteSuccessClient";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { shopNavLinks } from "@/app/shop/shopData";

export default async function ShopQuoteSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-12 sm:py-16">
        <div className={shopStyles.shell}>
          <QuoteSuccessClient quoteRef={params.ref} />
        </div>
      </section>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}
