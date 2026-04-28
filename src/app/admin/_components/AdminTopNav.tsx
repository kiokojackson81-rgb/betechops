"use client";
// src/app/admin/_components/AdminTopNav.tsx
import React, { useMemo } from "react";
import Link from "next/link";
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
          "flex gap-1 top-nav-scroll " +
          (mobile ? "overflow-x-auto px-2" : "overflow-visible px-2 md:px-0")
        }
        aria-label="Admin primary"
        role="navigation"
      >
        {NAV.map(({ href, label, icon: Icon, children }) => {
          const active = isItemActive(href, children);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                "nav-link group relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium border transition-colors whitespace-nowrap pb-2 " +
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
            </Link>
          );
        })}
      </nav>
      {activeGroup?.children?.length ? (
        <nav
          className={
            "flex gap-2 top-nav-scroll " +
            (mobile ? "overflow-x-auto px-2 pb-1" : "overflow-x-auto px-2 md:px-0 pb-1")
          }
          aria-label={`${activeGroup.label} submenu`}
        >
          {activeGroup.children.map((child) => {
            const [childPath] = child.href.split("?");
            const childActive = pathname === childPath || pathname.startsWith(childPath + "/");
            return (
              <Link
                key={child.href}
                href={child.href}
                aria-current={childActive ? "page" : undefined}
                className={
                  "relative whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors " +
                  (childActive
                    ? "border-emerald-400/40 bg-emerald-500/12 text-emerald-200"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white")
                }
              >
                {child.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
