"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type ShopImageSlot = {
  kind: "hero" | "category";
  key: string;
  label: string;
  currentUrl: string;
  defaultUrl: string;
};

type Props = {
  initialSlots: ShopImageSlot[];
};

export default function ShopImagesManager({ initialSlots }: Props) {
  const [slots, setSlots] = useState(initialSlots);
  const [statusByKey, setStatusByKey] = useState<Record<string, string>>({});

  const heroSlot = useMemo(() => slots.find((slot) => slot.kind === "hero") ?? null, [slots]);
  const categorySlots = useMemo(() => slots.filter((slot) => slot.kind === "category"), [slots]);

  async function uploadFile(slot: ShopImageSlot, file: File) {
    const form = new FormData();
    form.append("slotKind", slot.kind);
    form.append("slotKey", slot.key);
    form.append("file", file);

    setStatusByKey((prev) => ({ ...prev, [slot.key]: "Uploading..." }));
    const res = await fetch("/api/admin/shop-images", {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(String(data?.error ?? "Upload failed"));
    }

    const data = await res.json();
    const nextSlot = data?.slot as ShopImageSlot | undefined;
    if (!nextSlot) throw new Error("No slot returned");

    setSlots((prev) => prev.map((entry) => (entry.kind === nextSlot.kind && entry.key === nextSlot.key ? nextSlot : entry)));
    setStatusByKey((prev) => ({ ...prev, [slot.key]: "Saved" }));
  }

  async function resetSlot(slot: ShopImageSlot) {
    setStatusByKey((prev) => ({ ...prev, [slot.key]: "Resetting..." }));
    const res = await fetch("/api/admin/shop-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset", slotKind: slot.kind, slotKey: slot.key }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(String(data?.error ?? "Reset failed"));
    }
    const data = await res.json();
    const nextSlot = data?.slot as ShopImageSlot | undefined;
    if (!nextSlot) throw new Error("No slot returned");
    setSlots((prev) => prev.map((entry) => (entry.kind === nextSlot.kind && entry.key === nextSlot.key ? nextSlot : entry)));
    setStatusByKey((prev) => ({ ...prev, [slot.key]: "Reset to default" }));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[#0b0e13] p-5">
        <h1 className="text-2xl font-semibold text-slate-100">Shop Images</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Replace storefront category and home-banner images by uploading a new file. Changes save to the database and reflect on the shop immediately.
        </p>
      </div>

      {heroSlot ? (
        <section className="rounded-2xl border border-white/10 bg-[#0b0e13] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Home</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-100">{heroSlot.label}</h2>
            </div>
            <div className="text-sm text-slate-400">{statusByKey[heroSlot.key] ?? "Ready"}</div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
              <div className="relative aspect-[16/7]">
                <Image src={heroSlot.currentUrl} alt={heroSlot.label} fill sizes="100vw" className="object-cover" />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-medium text-slate-200">Upload new banner</div>
              <p className="mt-1 text-xs leading-5 text-slate-400">Best fit: wide horizontal image, around 1500 x 500 px or 3:1 ratio.</p>
              <input
                type="file"
                accept="image/*"
                className="mt-4 block w-full rounded-lg border border-white/10 bg-slate-950/60 p-2 text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-500/15 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-emerald-200"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    await uploadFile(heroSlot, file);
                  } catch (error) {
                    setStatusByKey((prev) => ({ ...prev, [heroSlot.key]: error instanceof Error ? error.message : "Upload failed" }));
                  } finally {
                    event.currentTarget.value = "";
                  }
                }}
              />
              <button
                type="button"
                className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
                onClick={async () => {
                  try {
                    await resetSlot(heroSlot);
                  } catch (error) {
                    setStatusByKey((prev) => ({ ...prev, [heroSlot.key]: error instanceof Error ? error.message : "Reset failed" }));
                  }
                }}
              >
                Reset to default
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-[#0b0e13] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Categories</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-100">Category tile images</h2>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categorySlots.map((slot) => (
            <div key={slot.key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-100">{slot.label}</div>
                <div className="text-xs text-slate-400">{statusByKey[slot.key] ?? "Ready"}</div>
              </div>

              <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50">
                <div className="relative aspect-[3/1]">
                  <Image src={slot.currentUrl} alt={slot.label} fill sizes="(max-width: 1280px) 50vw, 33vw" className="object-contain bg-[linear-gradient(135deg,#fff7e6_0%,#ffffff_100%)] p-2" />
                </div>
              </div>

              <input
                type="file"
                accept="image/*"
                className="mt-3 block w-full rounded-lg border border-white/10 bg-slate-950/60 p-2 text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-500/15 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-emerald-200"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    await uploadFile(slot, file);
                  } catch (error) {
                    setStatusByKey((prev) => ({ ...prev, [slot.key]: error instanceof Error ? error.message : "Upload failed" }));
                  } finally {
                    event.currentTarget.value = "";
                  }
                }}
              />

              <button
                type="button"
                className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
                onClick={async () => {
                  try {
                    await resetSlot(slot);
                  } catch (error) {
                    setStatusByKey((prev) => ({ ...prev, [slot.key]: error instanceof Error ? error.message : "Reset failed" }));
                  }
                }}
              >
                Reset to default
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
