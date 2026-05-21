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
    <section id={id} className="py-5 sm:py-6">
      <div className={shopStyles.shell}>
        <div className={`${shopStyles.lightCard} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-[#7a0000]/8 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5 lg:px-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p>
            </div>
            <Link href={href} className="inline-flex items-center text-sm font-black text-[#7a0000] transition hover:text-[#560000]">
              See all
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-4 lg:p-5">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
