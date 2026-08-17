"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, CheckCheck, Clock3, RefreshCw } from "lucide-react";
import type { SupervisorTodoCategory, SupervisorTodoItem } from "@/lib/supervisorTodo";

type Filter = "ALL" | SupervisorTodoCategory;

const categoryLabels: Record<SupervisorTodoCategory, string> = {
  PRICING: "Pricing",
  JUMIA: "Jumia weekly",
  LIPA_POLE_POLE: "Lipa Pole Pole",
};

function withImpersonation(href: string, impersonateId: string) {
  if (!impersonateId) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}impersonateId=${encodeURIComponent(impersonateId)}`;
}

export default function SupervisorTodoCenter({ impersonateId }: { impersonateId: string }) {
  const [items, setItems] = useState<SupervisorTodoItem[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadItems = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const query = impersonateId ? `?impersonateId=${encodeURIComponent(impersonateId)}` : "";
      const response = await fetch(`/api/attendant/online/supervisor-todos${query}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Failed to load supervisor tasks.");
      setItems(Array.isArray(body?.items) ? body.items : []);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load supervisor tasks.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [impersonateId]);

  useEffect(() => {
    void loadItems();
    const refresh = () => void loadItems(true);
    const intervalId = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
    };
  }, [loadItems]);

  const counts = items.reduce<Record<SupervisorTodoCategory, number>>(
    (totals, item) => ({ ...totals, [item.category]: totals[item.category] + 1 }),
    { PRICING: 0, JUMIA: 0, LIPA_POLE_POLE: 0 },
  );
  const visibleItems = filter === "ALL" ? items : items.filter((item) => item.category === filter);

  return (
    <section className="overflow-hidden rounded-[28px] border border-cyan-400/20 bg-[#091223] shadow-2xl shadow-black/20">
      <div className="border-b border-white/10 bg-gradient-to-r from-cyan-400/10 via-transparent to-amber-400/10 p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-cyan-200">
              <BellRing className="h-4 w-4" /> Supervisor action center
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Today&apos;s operational to-do list</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              Live pricing, Jumia weekly, and Lipa Pole Pole work. Completed tasks disappear automatically when their workflow is resolved.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Open</div>
              <div className="mt-1 text-2xl font-semibold text-white">{items.length}</div>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/70">Automatic sync</div>
              <div className="mt-1 text-sm font-semibold text-emerald-200">Every 15 seconds</div>
            </div>
            <button
              type="button"
              onClick={() => void loadItems()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/5 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {([
            ["ALL", "All", items.length],
            ["PRICING", "Pricing", counts.PRICING],
            ["JUMIA", "Jumia weekly", counts.JUMIA],
            ["LIPA_POLE_POLE", "Lipa Pole Pole", counts.LIPA_POLE_POLE],
          ] as Array<[Filter, string, number]>).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${filter === key ? "border-cyan-400/50 bg-cyan-400/10 text-white" : "border-white/10 text-slate-300 hover:bg-white/5"}`}
            >
              {label} <span className="ml-1 text-xs text-slate-500">{count}</span>
            </button>
          ))}
        </div>

        {errorMessage ? (
          <div className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {loading && items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">Loading operational tasks...</div>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-8 text-center">
              <CheckCheck className="mx-auto h-7 w-7 text-emerald-300" />
              <div className="mt-2 font-semibold text-emerald-100">No open tasks in this view</div>
              <div className="mt-1 text-sm text-slate-400">The queue will update automatically when new work arrives.</div>
            </div>
          ) : visibleItems.map((item) => (
            <article key={item.key} className={`rounded-3xl border p-4 ${item.priority === "URGENT" ? "border-rose-400/25 bg-rose-400/5" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                      {categoryLabels[item.category]}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${item.priority === "URGENT" ? "bg-rose-400/15 text-rose-200" : item.priority === "HIGH" ? "bg-amber-400/15 text-amber-100" : "bg-slate-400/10 text-slate-300"}`}>
                      {item.priority}
                    </span>
                    {item.contextLabel ? <span className="text-xs text-slate-500">{item.contextLabel}</span> : null}
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{item.description}</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    {new Date(item.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
                <Link href={withImpersonation(item.href, impersonateId)} className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
                  {item.actionLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
