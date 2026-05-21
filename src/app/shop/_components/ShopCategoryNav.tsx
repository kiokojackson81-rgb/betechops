import Link from "next/link";
import type { ShopCategory } from "@/app/shop/shopData";
import { shopStyles } from "@/app/shop/_components/shopStyles";

type ShopCategoryNavProps = {
  categories: ShopCategory[];
};

function getCategoryHref(slug: string) {
  return slug === "request-quotation" ? "/shop/request-quote" : `/shop/category/${slug}`;
}

export default function ShopCategoryNav({ categories }: ShopCategoryNavProps) {
  return (
    <section className="border-b border-[#7a0000]/8 bg-[#fffaf2]">
      <div className={shopStyles.shell}>
        <div className="-mx-4 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
          <nav className="flex min-w-max items-center gap-2.5">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={getCategoryHref(category.slug)}
                className="inline-flex min-h-[2.75rem] items-center rounded-full border border-[#7a0000]/10 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#7a0000]/25 hover:text-[#7a0000]"
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
