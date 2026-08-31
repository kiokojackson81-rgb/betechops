"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Search, X } from "lucide-react";
import { getShopProductHref, SHOP_HOME_HREF } from "@/app/shop/storefrontPaths";

type ShopSearchBarProps = {
  compact?: boolean;
  onSearchStateChange?: (active: boolean) => void;
  onSearchSubmit?: () => void;
};

type ShopSuggestion = {
  id: string;
  name: string;
  category: string;
  slug: string;
  opsProductId: string | null;
};

export default function ShopSearchBar({ compact = false, onSearchStateChange, onSearchSubmit }: ShopSearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = useMemo(() => searchParams.get("q") ?? "", [searchParams]);
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<ShopSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
    onSearchStateChange?.(Boolean(initialQuery.trim()));
  }, [initialQuery, onSearchStateChange]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
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
        const response = await fetch(`/api/shop/products?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          setSuggestions([]);
          return;
        }

        const payload = (await response.json()) as {
          products?: Array<{ id: string; name: string; category: string; slug: string; opsProductId: string | null }>;
        };

        const nextSuggestions = Array.from(
          new Map(
            (payload.products ?? [])
              .slice(0, 6)
              .map((product) => [
                product.name.trim().toLowerCase(),
                {
                  id: product.id,
                  name: product.name,
                  category: product.category,
                  slug: product.slug,
                  opsProductId: product.opsProductId,
                },
              ]),
          ).values(),
        );

        setSuggestions(nextSuggestions);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const inputId = compact ? "shop-search-compact" : "shop-search";
  const trimmedQuery = query.trim();
  const showDropdown = open && trimmedQuery.length > 0;

  const goToSearchResults = (value: string) => {
    const trimmed = value.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    setOpen(false);
    onSearchStateChange?.(Boolean(trimmed));
    onSearchSubmit?.();
    router.push(`${SHOP_HOME_HREF}${params.toString() ? `?${params.toString()}` : ""}#shop-catalogue`);
  };

  const clearSearch = () => {
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    onSearchStateChange?.(false);
    onSearchSubmit?.();
    router.push(SHOP_HOME_HREF);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form
        action="/"
        onSubmit={(event) => {
          event.preventDefault();
          goToSearchResults(query);
        }}
        className={`flex w-full items-center gap-2 rounded-full border border-[#7a0000]/12 bg-white px-3 shadow-[0_12px_24px_rgba(15,23,42,0.05)] ${
          compact ? "min-h-[2.95rem]" : "min-h-[3.15rem]"
        }`}
      >
        <label htmlFor={inputId} className="sr-only">
          Search products, brands & categories
        </label>
        <Search className="h-4 w-4 shrink-0 text-[#7a0000]" />
        <input
          id={inputId}
          name="q"
          type="search"
          autoComplete="off"
          value={query}
          onFocus={() => {
            if (query.trim()) setOpen(true);
          }}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setOpen(Boolean(nextQuery.trim()));
            if (!nextQuery.trim() && initialQuery) clearSearch();
          }}
          placeholder="Search products, brands & categories"
          className="h-full w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
        />
        {query ? (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear product search"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-[#7a0000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="submit"
          aria-label="Search products, brands & categories"
          className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#f59e0b] font-bold text-white shadow-[0_10px_20px_rgba(245,158,11,0.22)] ${
            compact ? "h-9 px-3 text-xs" : "h-10 px-4 text-sm"
          }`}
        >
          Search
        </button>
      </form>

      {showDropdown ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.55rem)] z-50 overflow-hidden rounded-[26px] border border-[#7a0000]/10 bg-white shadow-[0_24px_50px_rgba(15,23,42,0.14)]">
          <button
            type="button"
            onClick={() => goToSearchResults(query)}
            className="flex w-full items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 text-left transition hover:bg-[#fcfaf7] sm:px-5"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">Search</div>
              <div className="truncate text-base font-semibold text-slate-900">{trimmedQuery}</div>
            </div>
            <span className="inline-flex items-center rounded-full bg-[#f59e0b] px-3 py-1 text-sm font-bold text-white">
              Search
            </span>
          </button>

          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => {
                setQuery(suggestion.name);
                setOpen(false);
                onSearchSubmit?.();
                router.push(getShopProductHref(suggestion.slug, suggestion.opsProductId));
              }}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#fcfaf7] sm:px-5"
            >
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-slate-900">{suggestion.name}</div>
                <div className="truncate text-xs text-slate-500">{suggestion.category}</div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          ))}

          {!loading && suggestions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500 sm:px-5">No matching products yet. Click search to view full results.</div>
          ) : null}

          {loading ? <div className="px-4 py-3 text-sm text-slate-500 sm:px-5">Loading suggestions...</div> : null}
        </div>
      ) : null}
    </div>
  );
}
