"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

type ProductSuggestion = {
  id: string;
  name: string;
  category: string;
};

type LipaPolePoleProductSearchProps = {
  initialQuery: string;
  initialSort: string;
};

const SORT_OPTIONS = [
  { value: "popular", label: "Most popular" },
  { value: "recent-purchase", label: "Recently purchased" },
  { value: "latest", label: "Newest products" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
] as const;

export default function LipaPolePoleProductSearch({
  initialQuery,
  initialSort,
}: LipaPolePoleProductSearchProps) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState(initialSort);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(initialQuery);
    setSort(initialSort);
  }, [initialQuery, initialSort]);

  useEffect(() => {
    const closeSuggestions = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", closeSuggestions);
    return () => document.removeEventListener("mousedown", closeSuggestions);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/shop/products?q=${encodeURIComponent(trimmed)}&lipaPolePole=eligible`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) {
          setSuggestions([]);
          return;
        }

        const payload = (await response.json()) as { products?: ProductSuggestion[] };
        setSuggestions(
          Array.from(
            new Map(
              (payload.products ?? []).slice(0, 6).map((product) => [
                product.name.trim().toLowerCase(),
                product,
              ]),
            ).values(),
          ),
        );
      } catch (error) {
        if ((error as Error).name !== "AbortError") setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const navigate = (nextQuery: string, nextSort = sort) => {
    const params = new URLSearchParams();
    const trimmed = nextQuery.trim();
    if (trimmed) params.set("q", trimmed);
    if (nextSort !== "popular") params.set("sort", nextSort);
    setOpen(false);
    router.push(`/lipa-pole-pole${params.size ? `?${params.toString()}` : ""}#eligible-products`);
  };

  const showSuggestions = open && query.trim().length > 0;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        navigate(query);
      }}
      className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_auto]"
    >
      <div ref={wrapperRef} className="relative min-w-0">
        <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-[#7a0000]/12 bg-[#fcfaf7] px-4">
          <span className="sr-only">Search eligible Lipa Pole Pole products</span>
          <Search className="h-5 w-5 shrink-0 text-[#7a0000]" />
          <input
            name="q"
            type="search"
            autoComplete="off"
            value={query}
            onFocus={() => {
              if (query.trim()) setOpen(true);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            placeholder="Search eligible products"
            className="min-w-0 flex-1 bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-400"
          />
        </label>

        {showSuggestions ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.55rem)] z-50 overflow-hidden rounded-[24px] border border-[#7a0000]/10 bg-white shadow-[0_24px_50px_rgba(15,23,42,0.16)]">
            <button
              type="submit"
              className="flex w-full items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 text-left transition hover:bg-[#fcfaf7] sm:px-5"
            >
              <span className="min-w-0">
                <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">Search eligible products</span>
                <span className="block truncate font-semibold text-slate-900">{query.trim()}</span>
              </span>
              <Search className="h-4 w-4 shrink-0 text-[#7a0000]" />
            </button>

            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => {
                  setQuery(suggestion.name);
                  navigate(suggestion.name);
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#fcfaf7] sm:px-5"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-900">{suggestion.name}</span>
                  <span className="block truncate text-xs text-slate-500">{suggestion.category}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))}

            {loading ? <div className="px-5 py-3 text-sm text-slate-500">Loading suggestions...</div> : null}
            {!loading && suggestions.length === 0 ? (
              <div className="px-5 py-3 text-sm text-slate-500">No matching eligible products yet.</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <label className="relative flex min-h-14 items-center rounded-2xl border border-[#7a0000]/12 bg-[#fcfaf7]">
        <span className="sr-only">Sort eligible products</span>
        <select
          name="sort"
          value={sort}
          onChange={(event) => {
            const nextSort = event.target.value;
            setSort(nextSort);
            navigate(query, nextSort);
          }}
          className="h-full w-full appearance-none bg-transparent px-4 pr-11 text-sm font-bold text-slate-800 outline-none"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 h-4 w-4 text-[#7a0000]" />
      </label>

      <button type="submit" className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-[#8f0000] px-7 text-sm font-black text-white shadow-[0_14px_28px_rgba(122,0,0,0.18)] transition hover:bg-[#6f0000]">
        Search Products
      </button>
    </form>
  );
}
