"use client";
// src/app/admin/_components/AdminTopNav.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { NAV } from "./adminNav";

type Props = { mobile?: boolean; className?: string };

export default function AdminTopNav({ mobile = false, className = "" }: Props) {
  const pathname = usePathname() || "/admin";
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

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

  return (
    <nav
      ref={navRef}
      className={"flex gap-1 overflow-x-auto top-nav-scroll " + (mobile ? "px-2" : "px-2 md:px-0") + " " + className}
      aria-label="Admin primary"
      role="navigation"
    >
      {NAV.map(({ href, label, icon: Icon, children }) => {
        const active = isItemActive(href, children);
        const hasChildren = Array.isArray(children) && children.length > 0;

        if (hasChildren) {
          if (mobile) {
            const expanded = openMenu === href;
            return (
              <div key={href} className="relative">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenMenu((current) => (current === href ? null : href))}
                  className={
                    "nav-link group relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium border transition-colors whitespace-nowrap pb-2 " +
                    (active
                      ? "bg-white/10 border-white/20 text-white"
                      : "border-transparent text-slate-200 hover:text-white hover:bg-white/5")
                  }
                >
                  <Icon className="h-4 w-4 opacity-80 group-hover:opacity-100" />
                  <span>{label}</span>
                  <ChevronDown className={"h-4 w-4 transition-transform " + (expanded ? "rotate-180" : "")} />
                  <span
                    className={
                      "absolute left-2 right-2 -bottom-[2px] h-[2px] rounded bg-gradient-to-r from-indigo-400 via-pink-400 to-violet-400 transform transition-all origin-left " +
                      (active ? "scale-x-100 opacity-90" : "scale-x-0 opacity-0 group-hover:opacity-60 group-hover:scale-x-100")
                    }
                  />
                </button>
                {expanded ? (
                  <div className="mt-2 ml-3 flex min-w-[220px] flex-col gap-1 rounded-xl border border-white/10 bg-slate-950/95 p-2">
                    {children.map((child) => {
                      const [childPath] = child.href.split("?");
                      const childActive = pathname === childPath || pathname.startsWith(childPath + "/");
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={
                            "rounded-lg px-3 py-2 text-sm transition-colors " +
                            (childActive
                              ? "bg-white/10 text-white"
                              : "text-slate-300 hover:bg-white/5 hover:text-white")
                          }
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          }

          return (
            <div
              key={href}
              className="relative"
              onMouseEnter={() => setOpenMenu(href)}
              onMouseLeave={() => setOpenMenu((current) => (current === href ? null : current))}
            >
              <button
                type="button"
                aria-expanded={openMenu === href}
                onClick={() => setOpenMenu((current) => (current === href ? null : href))}
                className={
                  "nav-link group relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium border transition-colors whitespace-nowrap pb-2 " +
                  (active
                    ? "bg-white/10 border-white/20 text-white"
                    : "border-transparent text-slate-200 hover:text-white hover:bg-white/5")
                }
              >
                <Icon className="h-4 w-4 opacity-80 group-hover:opacity-100" />
                <span>{label}</span>
                <ChevronDown className={"h-4 w-4 transition-transform " + (openMenu === href ? "rotate-180" : "")} />
                <span
                  className={
                    "absolute left-2 right-2 -bottom-[2px] h-[2px] rounded bg-gradient-to-r from-indigo-400 via-pink-400 to-violet-400 transform transition-all origin-left " +
                    (active ? "scale-x-100 opacity-90" : "scale-x-0 opacity-0 group-hover:opacity-60 group-hover:scale-x-100")
                  }
                />
              </button>
              {openMenu === href ? (
                <div className="absolute left-0 top-full z-50 mt-2 min-w-[240px] rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl shadow-black/40 backdrop-blur">
                  {children.map((child) => {
                    const [childPath] = child.href.split("?");
                    const childActive = pathname === childPath || pathname.startsWith(childPath + "/");
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={
                          "block rounded-xl px-3 py-2 text-sm transition-colors " +
                          (childActive
                            ? "bg-white/10 text-white"
                            : "text-slate-300 hover:bg-white/5 hover:text-white")
                        }
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        }

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
  );
}
