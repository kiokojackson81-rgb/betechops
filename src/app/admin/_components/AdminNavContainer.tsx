"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import AdminTopNav from "./AdminTopNav";
import AdminTopbarBadges from "./AdminTopbarBadges";
import AdminUserMenu from "./AdminUserMenu";

export default function AdminNavContainer() {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    function onClick(e: MouseEvent) {
      if (open && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        if (!(e.target instanceof HTMLElement && e.target.dataset?.navToggle === "1")) {
          setOpen(false);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("click", onClick); };
  }, [open]);

  useEffect(() => { if (open) document.body.classList.add("overflow-hidden"); else document.body.classList.remove("overflow-hidden"); }, [open]);

  return (
    <div className="max-w-7xl mx-auto px-2 md:px-4 py-2 flex items-center gap-3">
      <button
        data-nav-toggle="1"
        aria-label="Toggle navigation menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md border border-white/15 bg-white/5 hover:bg-white/10"
      >
        <div className="space-y-1">
          <span className={"block h-[2px] w-5 bg-white transition-transform " + (open ? "translate-y-[5px] rotate-45" : "")}></span>
          <span className={"block h-[2px] w-5 bg-white transition-opacity " + (open ? "opacity-0" : "")}></span>
          <span className={"block h-[2px] w-5 bg-white transition-transform " + (open ? "-translate-y-[5px] -rotate-45" : "")}></span>
        </div>
      </button>
      <Link href="/admin" className="font-semibold tracking-tight text-base md:text-lg shrink-0 whitespace-nowrap">BetechOps — Unified Admin</Link>
      <div className="flex-1 hidden md:block overflow-hidden"><AdminTopNav /></div>
      <div className="hidden md:flex items-center gap-2">
        <AdminTopbarBadges />
        <AdminUserMenu />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" />
          <div ref={drawerRef} className="absolute top-0 left-0 right-0 bg-[var(--panel,#121723)] border-b border-white/10 pt-2 pb-4 shadow-xl animate-slideDown">
            <div className="px-3 mb-2"><AdminUserMenu compact /></div>
            <div className="px-1"><AdminTopNav mobile /></div>
            <div className="px-4 mt-4"><AdminTopbarBadges /></div>
          </div>
        </div>
      )}
    </div>
  );
}
