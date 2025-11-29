"use client";

import React, { useEffect, useMemo, useState } from "react";
import Card from "@/app/_components/Card";
import Input from "@/app/_components/Input";
import Textarea from "@/app/_components/Textarea";
import Button from "@/app/_components/Button";
import ReceiptsEditor from "@/app/_components/ReceiptsEditor";
import { showToast } from "@/lib/ui/toast";
import { DayName, marketingDayConfigs, marketingFieldKeys, marketingFieldTypes } from "@/lib/marketingDayConfigs";

type MarketingDailyFormState = {
  date: string;
  dayOfWeek: DayName;
  fields: Record<string, boolean | number | string | null>;
};

type ReceiptItem = { id: string; productName: string; buyingPrice: number | "" };
type ReceiptRow = {
  id: string;
  receiptNumber: string;
  sellingTotal: number | "";
  paymentMethod: "MPESA" | "CASH";
  items: ReceiptItem[];
};

const dayOptions: DayName[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const deriveDayOfWeek = (dateStr: string): DayName => {
  const d = new Date(dateStr);
  const map = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const label = map[d.getDay()] as DayName | "Sunday";
  const exists = marketingDayConfigs.find((c) => c.day === label);
  return exists?.day ?? "Monday";
};

const defaultFormState = (): MarketingDailyFormState => {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const day = deriveDayOfWeek(todayStr);
  const dynamic: Record<string, boolean | number | string | null> = {};
  marketingFieldKeys.forEach((key) => {
    const type = marketingFieldTypes[key];
    dynamic[key] = type === "yesno" ? false : "";
  });
  return {
    date: todayStr,
    dayOfWeek: day,
    fields: { ...dynamic },
  };
};

const newSaleRow = (): ReceiptRow => ({
  id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2),
  receiptNumber: "",
  sellingTotal: "",
  paymentMethod: "MPESA",
  items: [
    {
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      productName: "",
      buyingPrice: "",
    },
  ],
});

const pillClass = (checked: boolean) =>
  `rounded-full border px-4 py-2 text-sm font-medium transition ${
    checked
      ? "border-emerald-400 bg-emerald-400 text-black shadow-lg shadow-emerald-500/20"
      : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500"
  }`;

export default function MarketingTrackerPage() {
  const [form, setForm] = useState<MarketingDailyFormState>(() => defaultFormState());
  const [receipts, setReceipts] = useState<ReceiptRow[]>([newSaleRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [periodSummary, setPeriodSummary] = useState<null | {
    period: { key: string; label: string; start: string; end: string };
    aggregates: { totalSales: number; totalItems: number; paymentStats: { totalSalesMpesa: number; totalSalesCash: number }; commission: { commission: number } };
  }>(null);

  const config = useMemo(() => marketingDayConfigs.find((c) => c.day === form.dayOfWeek) ?? marketingDayConfigs[0], [form.dayOfWeek]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, dayOfWeek: deriveDayOfWeek(prev.date) }));
  }, [form.date]);

  useEffect(() => {
    if (!periodSummary) return;
    const timer = setTimeout(() => setPeriodSummary(null), 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [periodSummary]);

  const groupedYesNo = useMemo(() => {
    const groups = new Map<string, typeof config.yesNoFields>();
    (config?.yesNoFields || []).forEach((f) => {
      if (!groups.has(f.section)) groups.set(f.section, []);
      groups.get(f.section)?.push(f);
    });
    return Array.from(groups.entries());
  }, [config]);

  const updateField = (key: string, value: boolean | number | string | null) => {
    setForm((prev) => ({ ...prev, fields: { ...prev.fields, [key]: value } }));
  };

  const totals = useMemo(() => {
    const totalSales = receipts.reduce((sum, r) => sum + (typeof r.sellingTotal === "number" ? r.sellingTotal : Number(r.sellingTotal || 0)), 0);
    const totalProfit = receipts.reduce(
      (sum, r) =>
        sum +
        ((typeof r.sellingTotal === "number" ? r.sellingTotal : Number(r.sellingTotal || 0)) -
          r.items.reduce((s, it) => s + (typeof it.buyingPrice === "number" ? it.buyingPrice : Number(it.buyingPrice || 0)), 0)),
      0
    );
    const totalItems = receipts.reduce((sum, r) => sum + r.items.length, 0);
    return { totalSales, totalProfit, totalItems };
  }, [receipts]);

  const updateReceipt = (id: string, patch: Partial<ReceiptRow>) => {
    setReceipts((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addReceipt = () => setReceipts((rows) => [...rows, newSaleRow()]);
  const removeReceipt = (id: string) => setReceipts((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));

  const addItem = (receiptId: string) => {
    setReceipts((rows) =>
      rows.map((r) =>
        r.id === receiptId
          ? {
              ...r,
              items: [
                ...r.items,
                {
                  id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2),
                  productName: "",
                  buyingPrice: "",
                },
              ],
            }
          : r
      )
    );
  };

  const updateItem = (receiptId: string, itemId: string, patch: Partial<ReceiptItem>) => {
    setReceipts((rows) =>
      rows.map((r) =>
        r.id === receiptId
          ? { ...r, items: r.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }
          : r
      )
    );
  };

  const removeItem = (receiptId: string, itemId: string) => {
    setReceipts((rows) =>
      rows.map((r) =>
        r.id === receiptId
          ? {
              ...r,
              items:
                r.items.filter((it) => it.id !== itemId).length > 0
                  ? r.items.filter((it) => it.id !== itemId)
                  : r.items,
            }
          : r
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const yesNo: Record<string, boolean> = {};
      const numeric: Record<string, number> = {};
      const text: Record<string, string> = {};
      Object.entries(marketingFieldTypes).forEach(([key, type]) => {
        const raw = form.fields[key];
        if (type === "yesno") yesNo[key] = Boolean(raw);
        else if (type === "numeric") numeric[key] = Number(raw || 0);
        else text[key] = typeof raw === "string" ? raw : "";
      });

      const payload = {
        date: form.date,
        dayOfWeek: form.dayOfWeek,
        receipts: receipts.map((r) => ({
          receiptNumber: r.receiptNumber,
          sellingTotal: r.sellingTotal === "" ? 0 : Math.max(0, Number(r.sellingTotal)),
          paymentMethod: r.paymentMethod,
          items: r.items.map((it) => ({
            productName: it.productName.trim(),
            buyingPrice: it.buyingPrice === "" ? 0 : Math.max(0, Number(it.buyingPrice)),
          })),
        })),
        yesNo,
        numeric,
        text,
      };

      const res = await fetch("/api/marketing/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast("Marketing daily tracker submitted", "success");
        setForm(defaultFormState());
        setReceipts([newSaleRow()]);
        const data = await res.json().catch(() => null);
        if (data?.periodSummary) {
          setPeriodSummary({
            period: {
              key: "",
              label: data.periodSummary.periodLabel,
              start: "",
              end: "",
            },
            aggregates: {
              totalSales: data.periodSummary.periodSales,
              totalItems: data.periodSummary.totalItems ?? 0,
              paymentStats: {
                totalSalesMpesa: data.periodSummary.mpesaTotal ?? 0,
                totalSalesCash: data.periodSummary.cashTotal ?? 0,
              },
              commission: { commission: data.periodSummary.commission ?? 0 },
            },
          });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Failed to submit entry", "error");
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to submit entry", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Daily Task Ops (Mon–Sat)</h1>
          <p className="text-sm text-slate-300">Every task you complete brings you closer to your next reward.</p>
        </header>

        {periodSummary && (
          <Card className="border-emerald-700/60 bg-emerald-900/20 text-emerald-100 shadow-xl shadow-emerald-900/30">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-200">Summary so far for this trading period</p>
                  <h2 className="text-lg font-semibold">{periodSummary.period.label}</h2>
                  <p className="text-xs text-emerald-200">{periodSummary.period.label}</p>
                </div>
                <Button type="button" variant="secondary" onClick={() => setPeriodSummary(null)}>
                  Hide
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 text-sm">
                <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-200">Period sales</div>
                  <div className="text-xl font-semibold text-white">KES {periodSummary.aggregates.totalSales.toLocaleString()}</div>
                </div>
                <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-200">Total items</div>
                  <div className="text-xl font-semibold text-white">{periodSummary.aggregates.totalItems.toLocaleString()}</div>
                </div>
                <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-200">MPESA vs Cash</div>
                  <div className="text-sm">MPESA KES {periodSummary.aggregates.paymentStats.totalSalesMpesa.toLocaleString()}</div>
                  <div className="text-sm">Cash KES {periodSummary.aggregates.paymentStats.totalSalesCash.toLocaleString()}</div>
                </div>
                <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-200">Commission so far</div>
                  <div className="text-xl font-semibold text-white">KES {periodSummary.aggregates.commission.commission.toLocaleString()}</div>
                </div>
              </div>
              <p className="text-xs text-emerald-200">
                This panel auto-hides after 5 minutes. Commission shown is cumulative for the current trading period.
              </p>
            </div>
          </Card>
        )}

        <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">Date</label>
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
                />
                <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200">
                  {form.dayOfWeek}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">Day of week</label>
              <select
                value={form.dayOfWeek}
                onChange={(e) => setForm((prev) => ({ ...prev, dayOfWeek: e.target.value as DayName }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
              >
                {dayOptions.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <ReceiptsEditor receipts={receipts} setReceipts={setReceipts} totals={totals} />

        <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Day checklist</p>
              <h2 className="text-xl font-semibold">{config.day}</h2>
            </div>
            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
              Auto-loaded from selected day
            </div>
          </div>

          <div className="space-y-6">
            {groupedYesNo.map(([section, fields]) => (
              <div key={section} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">{section}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {fields.map((f) => (
                    <button
                      type="button"
                      key={f.key}
                      onClick={() => updateField(f.key, !Boolean(form.fields[f.key]))}
                      className={pillClass(Boolean(form.fields[f.key]))}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {(config.numericFields || []).length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">Numeric checks</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {(config.numericFields || []).map((f) => (
                    <div key={f.key} className="space-y-2">
                      <label className="text-xs uppercase tracking-wide text-slate-400">{f.label}</label>
                      <Input
                        type="number"
                        min={f.min}
                        value={String(form.fields[f.key] ?? "")}
                        onChange={(e) => updateField(f.key, e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(config.textFields || []).length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">Notes</h3>
                <div className="grid gap-3">
                  {(config.textFields || []).map((f) => (
                    <div key={f.key} className="space-y-2">
                      <label className="text-xs uppercase tracking-wide text-slate-400">{f.label}</label>
                      <Textarea
                        value={String(form.fields[f.key] ?? "")}
                        onChange={(e) => updateField(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        rows={3}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 backdrop-blur">
          <Button type="reset" variant="secondary" onClick={() => setForm(defaultFormState())} className="px-5">
            Reset
          </Button>
          <Button type="submit" variant="primary" className="px-5" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit day"}
          </Button>
        </div>
      </form>
    </div>
  );
}
