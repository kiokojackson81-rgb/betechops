import Link from "next/link";
import type { ShopProductSection } from "@/app/shop/shopData";
import ProductCard from "@/app/shop/_components/ProductCard";
import { shopStyles } from "@/app/shop/_components/shopStyles";

type ProductSectionProps = {
  section: ShopProductSection;
};

export default function ProductSection({ section }: ProductSectionProps) {
  const sectionRouteMap: Record<string, string> = {
    "best-selling-solar-kits": "/shop/category/solar-full-kits",
    "solar-panels": "/shop/category/solar-panels",
    "lithium-batteries": "/shop/category/lithium-batteries",
    "hybrid-inverters": "/shop/category/solar-inverters",
    "water-pumps": "/shop/category/solar-water-pumps",
    "solar-lights": "/shop/category/solar-lights",
  };

  return (
    <section id={section.slug} className="py-8 sm:py-10">
      <div className={shopStyles.shell}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className={shopStyles.sectionEyebrow}>{section.eyebrow}</div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{section.title}</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">{section.description}</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href={sectionRouteMap[section.slug] || "/shop"} className={`${shopStyles.secondaryButton} w-full sm:w-auto`}>
              View Category
            </Link>
            <Link href="/shop/request-quote" className={`${shopStyles.secondaryButton} w-full sm:w-auto`}>
              Request Quote
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {section.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
