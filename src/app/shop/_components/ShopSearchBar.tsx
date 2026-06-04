"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";

type ShopSearchBarProps = {
  compact?: boolean;
};

export default function ShopSearchBar({ compact = false }: ShopSearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = useMemo(() => searchParams.get("q") ?? "", [searchParams]);
  const [query, setQuery] = useState(initialQuery);

  const inputId = compact ? "shop-search-compact" : "shop-search";

  const submitSearch = () => {
    const trimmed = query.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    const href = `/shop${params.toString() ? `?${params.toString()}` : ""}#shop-catalogue`;
    router.push(href);
  };

  return (
    <form
      action="/shop"
      onSubmit={(event) => {
        event.preventDefault();
        submitSearch();
      }}
      className={`flex w-full items-center gap-2 rounded-full border border-[#7a0000]/12 bg-white px-3 shadow-[0_12px_24px_rgba(15,23,42,0.05)] ${
        compact ? "min-h-[2.95rem]" : "min-h-[3.15rem]"
      }`}
    >
      <label htmlFor={inputId} className="sr-only">
        Search solar products
      </label>
      <Search className="h-4 w-4 shrink-0 text-[#7a0000]" />
      <input
        id={inputId}
        name="q"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search solar kits, inverters, batteries, pumps..."
        className="h-full w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
      />
      <button
        type="submit"
        aria-label="Search solar products"
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-[#7a0000]/10 bg-[#fff7ea] text-[#7a0000] ${
          compact ? "h-9 w-9" : "h-10 w-10"
        }`}
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>
    </form>
  );
}
