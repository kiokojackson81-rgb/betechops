import type { Metadata } from "next";
import Link from "next/link";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ShopBreadcrumbs from "@/app/shop/_components/ShopBreadcrumbs";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import {
  getShopCategoryDepartment,
  SHOP_CATEGORY_DEFINITIONS,
} from "@/app/shop/shopCatalogConfig";
import { shopNavLinks } from "@/app/shop/shopData";
import {
  getShopCategoryHref,
  getShopSubcategoryHref,
  SHOP_HOME_HREF,
} from "@/app/shop/storefrontPaths";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { getShopBaseUrl } from "@/lib/runtimeUrls";

export const revalidate = 600;

export const metadata: Metadata = buildShopMetadata({
  title: "All Departments",
  description:
    "Browse Betech Solar & Energy and general marketplace departments, with clear subcategories for every product type.",
  alternates: { canonical: `${getShopBaseUrl()}/departments` },
});

export default function DepartmentsPage() {
  const solar = SHOP_CATEGORY_DEFINITIONS.filter(
    (category) => getShopCategoryDepartment(category) === "SOLAR_ENERGY",
  );
  const general = SHOP_CATEGORY_DEFINITIONS.filter(
    (category) => getShopCategoryDepartment(category) === "GENERAL",
  );

  return (
    <div className={`${shopStyles.page} pb-20 lg:pb-0`}>
      <ShopHeader navLinks={shopNavLinks} />
      <main className="py-4 sm:py-6">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs
            items={[
              { label: "Shop", href: SHOP_HOME_HREF },
              { label: "All Departments" },
            ]}
          />
          <section className="mt-3 overflow-hidden rounded-[24px] border border-[#7a0000]/10 bg-[linear-gradient(135deg,#fff7ea_0%,#ffffff_52%,#f0fbf5_100%)] p-5 sm:p-7">
            <div className={shopStyles.sectionEyebrow}>Betech Catalogue</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              All departments
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
              Solar & Energy remains our specialist catalogue. Other Categories
              brings together the wider Betech warehouse and marketplace range
              without mixing specialist solar products into general departments.
            </p>
          </section>

          <DepartmentSection
            title="Solar & Energy"
            description="Betech's core solar catalogue for homes, biashara, farms and commercial systems."
            categories={solar}
            featured
          />
          <DepartmentSection
            title="Other Categories"
            description="General marketplace departments, structured to make browsing and product posting clear."
            categories={general}
          />
        </div>
      </main>
      <ShopFooter />
      <FloatingWhatsApp hideOnMobile />
    </div>
  );
}

function DepartmentSection({
  title,
  description,
  categories,
  featured = false,
}: {
  title: string;
  description: string;
  categories: typeof SHOP_CATEGORY_DEFINITIONS;
  featured?: boolean;
}) {
  return (
    <section className="mt-7">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <div className={shopStyles.sectionEyebrow}>
            {featured ? "Core business" : "Marketplace catalogue"}
          </div>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <article
            key={category.value}
            className="rounded-[20px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
          >
            <Link
              href={getShopCategoryHref(category.value)}
              className="text-base font-black text-slate-950 transition hover:text-[#7a0000]"
            >
              {category.label}
            </Link>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {category.blurb}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {category.subcategories.slice(0, 7).map((subcategory) => (
                <Link
                  key={subcategory.value}
                  href={getShopSubcategoryHref(
                    category.value,
                    subcategory.value,
                  )}
                  className="rounded-full border border-[#7a0000]/10 bg-[#fcfaf7] px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-[#7a0000]/30 hover:text-[#7a0000]"
                >
                  {subcategory.label}
                </Link>
              ))}
              {category.subcategories.length > 7 ? (
                <Link
                  href={getShopCategoryHref(category.value)}
                  className="rounded-full bg-[#fff3d8] px-2.5 py-1 text-[11px] font-black text-[#7a0000]"
                >
                  +{category.subcategories.length - 7} more
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
