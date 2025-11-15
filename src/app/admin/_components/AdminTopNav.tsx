"use client";
// src/app/admin/_components/AdminTopNav.tsx
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./adminNav";

type Props = { mobile?: boolean; className?: string };

export default function AdminTopNav({ mobile = false, className = "" }: Props) {
  const pathname = usePathname() || "/admin";
  return (
    <nav
      className={"flex gap-1 overflow-x-auto top-nav-scroll " + (mobile ? "px-2" : "px-2 md:px-0") + " " + className}
      aria-label="Admin primary"
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              "nav-link group relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium border transition-colors whitespace-nowrap " +
              (active
                ? "bg-white/10 border-white/20 text-white"
                : "border-transparent text-slate-200 hover:text-white hover:bg-white/5")
            }
          >
            <Icon className="h-4 w-4 opacity-80 group-hover:opacity-100" />
            <span>{label}</span>
            <span
              className={
                "absolute left-2 right-2 -bottom-[2px] h-[2px] rounded bg-gradient-to-r from-indigo-400 via-pink-400 to-violet-400 transform transition-all origin-left " +
                (active ? "scale-x-100 opacity-90" : "scale-x-0 opacity-0 group-hover:opacity-60 group-hover:scale-x-100")
              }
            />
          </Link>
        );
      })}
    </nav>
  );
}
