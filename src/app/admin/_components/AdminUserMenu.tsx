"use client";
import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

function useOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, ref]);
}

export default function AdminUserMenu({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useOutside(ref, () => setOpen(false));

  // Try to use next-auth session if available
  // Guard useSession return shape to avoid runtime crash when the hook returns undefined
  const _sess = useSession() as { data?: any } | undefined;
  const session = _sess?.data;
  const name = session?.user?.name ?? session?.user?.email ?? "Admin";
  const image = session?.user?.image;
  const initial = (name && name.length) ? name.charAt(0).toUpperCase() : "A";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={"flex items-center gap-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " + (compact ? "text-xs" : "text-sm")}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name} className="h-6 w-6 rounded-full object-cover" />
        ) : (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 to-pink-500/40 text-white text-xs font-semibold shadow-inner">
            {initial}
          </span>
        )}
        {!compact && <span className="font-medium">{name}</span>}
        <svg width="12" height="12" viewBox="0 0 12 12" className={"transition-transform " + (open ? "rotate-180" : "")}><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-48 rounded-lg border border-white/10 bg-[var(--panel,#121723)] shadow-lg p-2 text-sm z-50">
          <div className="px-2 py-1 text-xs uppercase tracking-wide text-slate-400">Account</div>
          <Link href="/admin/settings" role="menuitem" className="block px-2 py-1 rounded hover:bg-white/5">Settings</Link>
          <button onClick={() => signOut()} role="menuitem" className="w-full text-left block px-2 py-1 rounded hover:bg-white/5">Sign out</button>
        </div>
      )}
    </div>
  );
}
