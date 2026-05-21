import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import QuoteRequestClient from "@/app/shop/_components/QuoteRequestClient";
import ShopBreadcrumbs from "@/app/shop/_components/ShopBreadcrumbs";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { shopNavLinks } from "@/app/shop/shopData";

export default async function ShopRequestQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-8 sm:py-10">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs items={[{ label: "Shop", href: "/shop" }, { label: "Request Quote" }]} />
          <div className="mt-5">
            <div className={shopStyles.sectionEyebrow}>Request a Solar System Quote</div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Request a Solar System Quote</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Our team will help size the right panels, inverter, battery and accessories for your needs.
            </p>
          </div>
          <div className="mt-6">
            <QuoteRequestClient preferredProduct={params.product ?? ""} />
          </div>
        </div>
      </section>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}
