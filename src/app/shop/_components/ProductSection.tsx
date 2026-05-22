import Link from "next/link";
import type { ShopProduct } from "@/app/shop/shopData";
import ProductCard from "@/app/shop/_components/ProductCard";
import { shopStyles } from "@/app/shop/_components/shopStyles";

type ProductSectionProps = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  products: ShopProduct[];
};

export default function ProductSection({ id, title, subtitle, href, products }: ProductSectionProps) {
  return (
    <section id={id} className="py-3.5 sm:py-4">
      <div className={shopStyles.shell}>
        <div className={`${shopStyles.lightCard} overflow-hidden`}>
          <div className="flex items-center justify-between gap-3 border-b border-[#7a0000]/8 px-4 py-3 sm:px-5 lg:px-6">
            <div className="max-w-2xl">
              <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{title}</h2>
              <p className="mt-0.5 text-xs leading-5 text-slate-600 sm:text-sm">{subtitle}</p>
            </div>
            <Link href={href} className="inline-flex items-center text-sm font-black text-[#7a0000] transition hover:text-[#560000]">
              See all
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2.5 p-2.5 sm:gap-3 sm:p-3 lg:grid-cols-4 lg:p-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
