import { Search, SlidersHorizontal } from "lucide-react";

type ShopSearchBarProps = {
  compact?: boolean;
};

export default function ShopSearchBar({ compact = false }: ShopSearchBarProps) {
  return (
    <form
      action="/shop"
      className={`flex w-full items-center gap-2 rounded-full border border-[#7a0000]/12 bg-white px-3 shadow-[0_12px_24px_rgba(15,23,42,0.05)] ${
        compact ? "min-h-[2.95rem]" : "min-h-[3.15rem]"
      }`}
    >
      <label htmlFor={compact ? "shop-search-compact" : "shop-search"} className="sr-only">
        Search solar products
      </label>
      <Search className="h-4 w-4 shrink-0 text-[#7a0000]" />
      <input
        id={compact ? "shop-search-compact" : "shop-search"}
        name="q"
        type="search"
        placeholder="Search solar kits, inverters, batteries, pumps..."
        className="h-full w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
      />
      <button
        type="button"
        aria-label="Filter solar products"
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-[#7a0000]/10 bg-[#fff7ea] text-[#7a0000] ${
          compact ? "h-9 w-9" : "h-10 w-10"
        }`}
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>
    </form>
  );
}
