import Link from "next/link";
import type { ShopCategory } from "@/app/shop/shopData";
import { shopStyles } from "@/app/shop/_components/shopStyles";

type ShopCategoryNavProps = {
  categories: ShopCategory[];
};

function getCategoryHref(slug: string) {
  return slug === "request-quote" ? "/shop/request-quote" : `/shop/category/${slug}`;
}

export default function ShopCategoryNav({ categories }: ShopCategoryNavProps) {
  return (
    <section className="border-b border-[#7a0000]/8 bg-[#fffaf2]">
      <div className={shopStyles.shell}>
        <div className="-mx-3.5 overflow-x-auto px-3.5 py-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <nav className="flex min-w-max items-center gap-2 pr-2">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={getCategoryHref(category.slug)}
                className="inline-flex min-h-[2.3rem] items-center whitespace-nowrap rounded-full border border-[#7a0000]/10 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-[0_8px_16px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-[#7a0000]/25 hover:text-[#7a0000] sm:text-sm"
              >
                {category.title}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}
