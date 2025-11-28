"use client";

import React, { useEffect, useMemo, useState } from "react";
import Card from "@/app/_components/Card";
import Input from "@/app/_components/Input";
import Textarea from "@/app/_components/Textarea";
import Button from "@/app/_components/Button";
import { showToast } from "@/lib/ui/toast";
import { DayName, marketingDayConfigs, marketingFieldKeys, marketingFieldTypes } from "@/lib/marketingDayConfigs";

type MarketingDailyFormState = {
  date: string;
  dayOfWeek: DayName;
  totalSales: string;
  totalProfit: string;
  photoFile: File | null;
  photoDataUrl: string | null;
} & Record<string, boolean | number | string | File | null>;

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
    totalSales: "",
    totalProfit: "",
    photoFile: null,
    photoDataUrl: null,
    ...dynamic,
  };
};

const pillClass = (checked: boolean) =>
  `rounded-full border px-4 py-2 text-sm font-medium transition ${
    checked
      ? "border-emerald-400 bg-emerald-400 text-black shadow-lg shadow-emerald-500/20"
      : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500"
  }`;

export default function MarketingTrackerPage() {
  const [form, setForm] = useState<MarketingDailyFormState>(() => defaultFormState());
  const [submitting, setSubmitting] = useState(false);

  const config = useMemo(() => marketingDayConfigs.find((c) => c.day === form.dayOfWeek) ?? marketingDayConfigs[0], [form.dayOfWeek]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, dayOfWeek: deriveDayOfWeek(prev.date) }));
  }, [form.date]);

  const groupedYesNo = useMemo(() => {
    const groups = new Map<string, typeof config.yesNoFields>();
    (config?.yesNoFields || []).forEach((f) => {
      if (!groups.has(f.section)) groups.set(f.section, []);
      groups.get(f.section)?.push(f);
    });
    return Array.from(groups.entries());
  }, [config]);

  const updateField = (key: string, value: boolean | number | string | null) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileChange = (fileList: FileList | null) => {
    const file = fileList && fileList[0] ? fileList[0] : null;
    if (!file) {
      setForm((prev) => ({ ...prev, photoFile: null, photoDataUrl: null }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, photoFile: file, photoDataUrl: typeof reader.result === "string" ? reader.result : null }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const yesNo: Record<string, boolean> = {};
      const numeric: Record<string, number> = {};
      const text: Record<string, string> = {};
      Object.entries(marketingFieldTypes).forEach(([key, type]) => {
        const raw = form[key];
        if (type === "yesno") yesNo[key] = Boolean(raw);
        else if (type === "numeric") numeric[key] = Number(raw || 0);
        else text[key] = typeof raw === "string" ? raw : "";
      });

      const payload = {
        date: form.date,
        dayOfWeek: form.dayOfWeek,
        totalSales: Number(form.totalSales || 0),
        totalProfit: Number(form.totalProfit || 0),
        yesNo,
        numeric,
        text,
        photoDataUrl: form.photoDataUrl,
        photoFilename: form.photoFile?.name ?? null,
      };

      const res = await fetch("/api/marketing/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast("Marketing daily tracker submitted", "success");
        setForm(defaultFormState());
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
          <h1 className="text-3xl font-semibold">Marketing Performance – Daily Tracker</h1>
          <p className="text-sm text-slate-300">
            Fill this once every day. Every task you complete brings you closer to your next reward.
          </p>
        </header>

        <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">Date</label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">Day of week</label>
              <select
                value={form.dayOfWeek}
                onChange={(e) => updateField("dayOfWeek", e.target.value as DayName)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
              >
                {dayOptions.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">Total Sales (KES)</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.totalSales}
                onChange={(e) => updateField("totalSales", e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">Total Profit (KES)</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.totalProfit}
                onChange={(e) => updateField("totalProfit", e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">Photo upload</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e.target.files)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-slate-100"
              />
              {form.photoFile ? (
                <p className="text-xs text-emerald-300">Selected: {form.photoFile.name}</p>
              ) : (
                <p className="text-xs text-slate-500">Optional: image proof of display or content.</p>
              )}
            </div>
          </div>
        </Card>

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
                      onClick={() => updateField(f.key, !Boolean(form[f.key]))}
                      className={pillClass(Boolean(form[f.key]))}
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
                        value={String(form[f.key] ?? "")}
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
                        value={String(form[f.key] ?? "")}
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

        <div className="flex items-center justify-end gap-3">
          <Button type="reset" variant="secondary" onClick={() => setForm(defaultFormState())} className="px-5">
            Reset
          </Button>
          <Button type="submit" variant="primary" className="px-5" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit day"}
          </Button>
        </div>
      </form>
    </div>
  );
}
