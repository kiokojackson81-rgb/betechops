"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import AdminTopNav from "./AdminTopNav";
import AdminTopbarBadges from "./AdminTopbarBadges";
import AdminUserMenu from "./AdminUserMenu";

export default function AdminNavContainer() {
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem("adminNavOpen") === "1"; } catch { return false; }
  });
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const firstLinkRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
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

  // Persist the open state across page transitions and lock body scroll when open
  useEffect(() => {
    try { localStorage.setItem("adminNavOpen", open ? "1" : "0"); } catch {}
    if (open) document.body.classList.add("overflow-hidden"); else document.body.classList.remove("overflow-hidden");
  }, [open]);

  // Keyboard navigation for drawer links (Arrow keys, Home/End)
  useEffect(() => {
    if (!open) return;
    const root = drawerRef.current;
    if (!root) return;
    const links = Array.from(root.querySelectorAll<HTMLElement>("a.nav-link, a[href]"));
    if (!links.length) return;
    let idx = 0;
    // focus first
    links[0].focus();

    function onKey(e: KeyboardEvent) {
      if (!links.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault(); idx = (idx + 1) % links.length; links[idx].focus();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault(); idx = (idx - 1 + links.length) % links.length; links[idx].focus();
      } else if (e.key === "Home") { e.preventDefault(); idx = 0; links[idx].focus(); }
      else if (e.key === "End") { e.preventDefault(); idx = links.length - 1; links[idx].focus(); }
      else if (e.key === "Escape") { setOpen(false); }
    }
    root.addEventListener("keydown", onKey as any);
    return () => root.removeEventListener("keydown", onKey as any);
  }, [open]);

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
      <div aria-hidden={!open} className={"fixed inset-0 z-40 md:hidden pointer-events-none " + (open ? "" : "opacity-0")}>
        <div
          className={"absolute inset-0 bg-black/60 transition-opacity " + (open ? "opacity-100 pointer-events-auto" : "opacity-0")}
          onClick={() => setOpen(false)}
        />
        <div
          ref={drawerRef}
          className={
            "absolute top-0 left-0 right-0 bg-[var(--panel,#121723)] border-b border-white/10 pt-2 pb-4 shadow-xl transform transition-transform " +
            (open ? "translate-y-0 opacity-100 pointer-events-auto animate-slideDown" : "-translate-y-3 opacity-0 pointer-events-none")
          }
          role="dialog"
          aria-modal="true"
        >
          <div className="px-3 mb-2"><AdminUserMenu compact /></div>
          <div className="px-1"><AdminTopNav mobile /></div>
          <div className="px-4 mt-4"><AdminTopbarBadges /></div>
        </div>
      </div>
    </div>
  );
}
