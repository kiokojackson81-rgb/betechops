"use client";
// src/app/admin/_components/AdminTopNav.tsx
import React, { useMemo } from "react";
import { usePathname } from "next/navigation";
import { NAV } from "./adminNav";

type Props = { mobile?: boolean; className?: string };

export default function AdminTopNav({ mobile = false, className = "" }: Props) {
  const pathname = usePathname() || "/admin";

  const isItemActive = useMemo(
    () => (href: string, children?: Array<{ href: string }>) => {
      const matchesHref = pathname === href || pathname.startsWith(href + "/");
      if (matchesHref) return true;
      return Boolean(
        children?.some((child) => {
          const [childPath] = child.href.split("?");
          return pathname === childPath || pathname.startsWith(childPath + "/");
        }),
      );
    },
    [pathname],
  );

  const activeGroup = useMemo(
    () =>
      NAV.find((item) => {
        if (!item.children?.length) return false;
        return isItemActive(item.href, item.children);
      }) ?? null,
    [isItemActive],
  );

  return (
    <div className={"space-y-2 " + className}>
      <nav
        className={
          "top-nav-scroll " +
          (mobile
            ? "flex gap-1 overflow-x-auto px-2"
            : "flex items-center gap-2 overflow-x-auto pb-1 px-0")
        }
        aria-label="Admin primary"
        role="navigation"
      >
        {NAV.map(({ href, label, icon: Icon, children }) => {
          const active = isItemActive(href, children);
          return (
            <a
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                "nav-link group relative flex items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] font-medium border transition-colors whitespace-nowrap shrink-0 " +
                (active
                  ? "bg-white/10 border-white/20 text-white"
                  : "border-transparent text-slate-200 hover:text-white hover:bg-white/5")
              }
              tabIndex={0}
            >
              <Icon className="h-4 w-4 opacity-80 group-hover:opacity-100" />
              <span>{label}</span>
              <span
                className={
                  "absolute left-2 right-2 -bottom-[2px] h-[2px] rounded bg-gradient-to-r from-indigo-400 via-pink-400 to-violet-400 transform transition-all origin-left " +
                  (active ? "scale-x-100 opacity-90" : "scale-x-0 opacity-0 group-hover:opacity-60 group-hover:scale-x-100")
                }
              />
            </a>
          );
        })}
      </nav>
      {activeGroup?.children?.length ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/90 shrink-0 md:block">
                {activeGroup.label}
            </div>
            <div className="hidden h-4 w-px bg-white/10 md:block" />
            <nav
              className={
                "top-nav-scroll " +
                (mobile
                  ? "flex gap-2 overflow-x-auto"
                  : "flex items-center gap-2 overflow-x-auto pb-1")
              }
              aria-label={`${activeGroup.label} submenu`}
            >
              {activeGroup.children.map((child) => {
                const [childPath] = child.href.split("?");
                const childActive = pathname === childPath || pathname.startsWith(childPath + "/");
                return (
                  <a
                    key={child.href}
                    href={child.href}
                    aria-current={childActive ? "page" : undefined}
                    className={
                      "relative whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors shrink-0 " +
                      (childActive
                        ? "border-emerald-400/40 bg-emerald-500/12 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]"
                        : "border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white")
                    }
                  >
                    {child.label}
                  </a>
                );
              })}
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
