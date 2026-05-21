import Link from "next/link";

type ShopBreadcrumbsProps = {
  items: Array<{
    label: string;
    href?: string;
  }>;
};

export default function ShopBreadcrumbs({ items }: ShopBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
          {index > 0 ? <span className="text-slate-300">/</span> : null}
          {item.href ? (
            <Link href={item.href} className="transition hover:text-[#7a0000]">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-slate-700">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
