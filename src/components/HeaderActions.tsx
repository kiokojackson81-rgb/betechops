"use client";

"use client";

import Link from "next/link";
import React from "react";

type Props = {
  receiptsHref?: string;
  createHref?: string;
  onSignOut?: () => void;
  showDot?: boolean;
};

export default function HeaderActions({
  receiptsHref = "/marketing/receipts",
  createHref = "/receipts",
  onSignOut,
  showDot = false,
}: Props) {
  return (
    <div className="flex flex-col gap-2 items-start sm:items-end">
      <div className="flex flex-wrap gap-3 items-center">
        <Link
          href={receiptsHref}
          aria-label="My receipts"
          className="relative flex items-center gap-2 rounded-full border border-white/10 bg-white/3 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-slate-100 transition-colors duration-150 hover:border-white/30 hover:bg-white/5"
        >
          {showDot && (
            <>
              <span className="absolute -top-2 -left-3 h-2 w-2 rounded-full bg-rose-500 ring-1 ring-slate-950" />
              <span className="absolute -top-2 -left-3 h-2 w-2 rounded-full bg-rose-500 opacity-60 animate-ping" />
            </>
          )}
          Receipts
        </Link>
        <Link
          href={createHref}
          className="flex items-center gap-2 rounded-full border-2 border-emerald-400 bg-transparent px-6 py-2 text-sm font-semibold uppercase tracking-wide text-emerald-100 transition-shadow duration-150 hover:shadow-[0_6px_18px_rgba(16,185,129,0.12)] hover:bg-emerald-600/5"
          aria-label="Create receipt"
        >
          Create receipt
        </Link>
        <button
          type="button"
          onClick={() => onSignOut && onSignOut()}
          className="rounded-full border border-white/10 bg-white/3 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-slate-100 transition-colors duration-150 hover:border-white/30 hover:bg-white/5"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
