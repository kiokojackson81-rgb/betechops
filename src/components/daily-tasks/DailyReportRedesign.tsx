"use client";
import React from "react";
import DailyTasksUI from "./DailyTasksUI";

export default function DailyReportRedesign() {
  // Render the original DailyTasksUI to preserve every data-entry field,
  // autosave and submit behaviour. We'll iterate on styling in-place so the
  // data model stays identical to the canonical component.
  return <DailyTasksUI />;
}
/**
 * Proposed redesign for the marketing attendant daily report.
 *
 * This file contains a skeleton React component that borrows heavily from the
 * existing marketing tracker UI.  It uses the same dark palette, card
 * components and pill‑style controls to provide a consistent look and feel
 * across all marketing pages.  While the data model and API integration are
 * omitted here, the layout and styling should serve as a solid foundation
 * for the real implementation.
 */

"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  // For the redesign we borrow the full daily tasks implementation from the
  // canonical daily UI but present it within the redesigned dark, card-based
  // layout. This file preserves every input and data field from the original
  // implementation (walk-ins, receipts, per-shop review, FB/IG replies, video
  // counts, live session details, weekly meeting, office cleaning, etc.).

  // Many helper components and the save/autosave logic are included below and
  // intentionally kept inline so this single component is self-contained for
  // the redesign while maintaining parity with the original form.

  // Reuse a few small helpers from the original implementation
  function renderIconForKey(key: string) {
    switch (key) {
      case "demoRecorded":
      case "demoVideosRecorded":
      case "officeClean":
        return <CheckSquareIcon className="w-4 h-4 opacity-80" />;
      case "commentsDMs":
        return <MessageSquare className="w-4 h-4 opacity-80" />;
      case "customersServed":
        return <Users className="w-4 h-4 opacity-80" />;
      case "improvementIdeas":
      case "weeklySummary":
        return <Lightbulb className="w-4 h-4 opacity-80" />;
      case "competitorNotes":
        return <ClipboardList className="w-4 h-4 opacity-80" />;
      default:
        return null;
    }
  }

  // Labeled numeric input used in marketplace cards
  const LabeledNumber: React.FC<{ label: string; value: number | ""; onChange: (v: number | "") => void }> = ({ label, value, onChange }) => (
    <div>
      <label className="text-sm font-medium text-slate-400 mb-1 block">{label}</label>
      <input
        type="number"
        value={value === "" ? "" : String(value)}
        onChange={(e) => onChange((e.target as HTMLInputElement).value === "" ? "" : Number((e.target as HTMLInputElement).value))}
        className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
      />
    </div>
  );

  function MarketplaceStockPricingCard({ value, onChange }: { value?: any; onChange: (next: any) => void }) {
    const v = (value || {}) as Record<string, any>;
    const [selected, setSelected] = useState<string>(marketplaceShopsTyped[0] as string);

    const ensureFull = () => marketplaceShopsTyped.reduce((acc: any, s) => ({ ...acc, [s]: { ...(v[s] || { stockChecked: false, pricingConfirmed: false, competitorsReviewed: false, oosReviewed: false, notes: "" }) } }), {});

    const updateShop = (shop: string, patch: Partial<any>) => {
      const full = ensureFull();
      const next = { ...full, [shop]: { ...(full[shop] || {}), ...patch } };
      onChange(next);
    };

    const current = (v[selected] as any) || { stockChecked: false, pricingConfirmed: false, competitorsReviewed: false, oosReviewed: false, notes: "" };

    const tabClass = (active: boolean) => `px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${active ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-gray-200'}`;
    const badgeClass = (active: boolean) => `inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-slate-800 text-gray-100`;

    return (
      <section className={cardClasses + " p-5"}>
        <h3 className="text-lg font-semibold text-slate-100">Marketplace stock &amp; pricing review</h3>
        <p className="mt-1 text-xs text-slate-400">Confirm stock, pricing, competitors &amp; out-of-stock per shop.</p>

        <div className="mt-4">
          <div className="mt-2 overflow-x-auto -mx-2 px-2 snap-x snap-mandatory" role="tablist" aria-label="Marketplace shops" style={{ scrollSnapType: 'x mandatory' }}>
            <div className="flex gap-2 whitespace-nowrap" style={{ padding: 6 }}>
              {marketplaceShopsTyped.map((shop) => {
                const active = selected === shop;
                return (
                  <button key={shop} type="button" role="tab" aria-selected={active} onClick={() => setSelected(shop)} className={`${tabClass(active)} snap-start min-w-[160px] px-5 py-3`}>
                    {shop}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <div className="mt-2 flex flex-wrap gap-3 items-center">
              <button type="button" className={badgeClass(Boolean(current.stockChecked))} onClick={() => updateShop(selected, { stockChecked: !Boolean(current.stockChecked) })}>Stock</button>
              <span className="text-sm text-slate-100">Stock checked</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-3 items-center">
              <button type="button" className={badgeClass(Boolean(current.pricingConfirmed))} onClick={() => updateShop(selected, { pricingConfirmed: !Boolean(current.pricingConfirmed) })}>Price</button>
              <span className="text-sm text-slate-100">Pricing confirmed</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-3 items-center">
              <button type="button" className={badgeClass(Boolean(current.competitorsReviewed))} onClick={() => updateShop(selected, { competitorsReviewed: !Boolean(current.competitorsReviewed) })}>Comp</button>
              <span className="text-sm text-slate-100">Competitors reviewed</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-3 items-center">
              <button type="button" className={badgeClass(Boolean(current.oosReviewed))} onClick={() => updateShop(selected, { oosReviewed: !Boolean(current.oosReviewed) })}>OOS</button>
              <span className="text-sm text-slate-100">OOS review</span>
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-medium text-slate-400">Notes (for {selected})</label>
              <textarea rows={3} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="Key issues or actions for this shop…" value={String(current.notes ?? '')} onChange={(e) => updateShop(selected, { notes: e.target.value })} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  function CustomerCommsActivityCard({ value, onChange }: { value: any; onChange: (next: any) => void }) {
    const v = value || {};
    return (
      <section className={cardClasses + " p-4"}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm uppercase tracking-wide text-slate-400">Customer & Communications Activity</h3>
          <div className="text-xs text-slate-400">Track walk-ins, messages and cleared inboxes</div>
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 mb-1 block">Walk-in served</label>
            <input aria-label="Walk-in served" type="number" value={String(v.walkInServed ?? 0)} onChange={(e) => onChange({ ...v, walkInServed: Number((e.target as HTMLInputElement).value || 0) })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
            <label className="text-xs font-medium text-slate-400 mb-1 block">Walk-ins who purchased</label>
            <input aria-label="Walk-ins who purchased" type="number" value={String(v.walkInsWhoPurchased ?? 0)} onChange={(e) => onChange({ ...v, walkInsWhoPurchased: Number((e.target as HTMLInputElement).value || 0) })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
            <label className="text-xs font-medium text-slate-400 mb-1 block">Calls handled</label>
            <input aria-label="Calls handled" type="number" value={String(v.callsHandled ?? 0)} onChange={(e) => onChange({ ...v, callsHandled: Number((e.target as HTMLInputElement).value || 0) })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
            <label className="text-xs font-medium text-slate-400 mb-1 block">WhatsApp/SMS replied</label>
            <input aria-label="WhatsApp SMS replied" type="number" value={String(v.whatsappSmsReplied ?? 0)} onChange={(e) => onChange({ ...v, whatsappSmsReplied: Number((e.target as HTMLInputElement).value || 0) })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-2 py-2"><input aria-label="FB comments replied" type="checkbox" className="w-5 h-5" checked={Boolean(v.fbCommentsReplied)} onChange={(e) => onChange({ ...v, fbCommentsReplied: e.target.checked })} /> <span className="text-sm text-slate-100">FB comments replied</span></label>
              <label className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-2 py-2"><input aria-label="FB DMs replied" type="checkbox" className="w-5 h-5" checked={Boolean(v.fbDmsReplied)} onChange={(e) => onChange({ ...v, fbDmsReplied: e.target.checked })} /> <span className="text-sm text-slate-100">FB DMs replied</span></label>
              <label className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-2 py-2"><input aria-label="IG comments replied" type="checkbox" className="w-5 h-5" checked={Boolean(v.igCommentsReplied)} onChange={(e) => onChange({ ...v, igCommentsReplied: e.target.checked })} /> <span className="text-sm text-slate-100">IG comments replied</span></label>
              <label className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-2 py-2"><input aria-label="IG DMs replied" type="checkbox" className="w-5 h-5" checked={Boolean(v.igDmsReplied)} onChange={(e) => onChange({ ...v, igDmsReplied: e.target.checked })} /> <span className="text-sm text-slate-100">IG DMs replied</span></label>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(v.fbAllCleared)} onChange={(e) => onChange({ ...v, fbAllCleared: e.target.checked })} /> <span className="text-sm">Facebook inbox cleared</span></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(v.igAllCleared)} onChange={(e) => onChange({ ...v, igAllCleared: e.target.checked })} /> <span className="text-sm">Instagram inbox cleared</span></label>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 mb-1 block">Competitor notes</label>
              <textarea rows={3} value={String(v.competitorNotes ?? "")} onChange={(e) => onChange({ ...v, competitorNotes: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-500" />
              <label className="text-xs font-medium text-slate-400 mb-1 block">Improvement suggestions</label>
              <textarea rows={3} value={String(v.improvementSuggestions ?? "")} onChange={(e) => onChange({ ...v, improvementSuggestions: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-500" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  function ProductMarketingVideosCard({ value, onChange }: { value?: any; onChange: (next: any) => void }) {
    const v = value || {};
    const setField = (key: string, val: any) => onChange({ ...v, [key]: val });
    return (
      <section className={cardClasses + " p-5"}>
        <h3 className="text-lg font-semibold text-slate-100">Product Marketing Output (Videos)</h3>
        <p className="mt-1 text-xs text-slate-400">Track promotional videos posted + demo videos recorded.</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Promotional/product videos posted</label>
            <input type="number" value={String(v.promoVideosPosted ?? 0)} onChange={(e) => setField("promoVideosPosted", Number((e.target as HTMLInputElement).value || 0))} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Product demo videos recorded</label>
            <input type="number" value={String(v.demoVideosRecorded ?? 0)} onChange={(e) => setField("demoVideosRecorded", Number((e.target as HTMLInputElement).value || 0))} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-xs text-slate-400 mb-2">Platforms posted to:</div>
          <div className="flex items-center gap-2">
            <button type="button" aria-pressed={Boolean(v.platforms?.facebook)} onClick={() => setField("platforms", { ...(v.platforms || {}), facebook: !Boolean(v.platforms?.facebook) })} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${v.platforms?.facebook ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-200"}`}>
              Facebook
            </button>
            <button type="button" aria-pressed={Boolean(v.platforms?.instagram)} onClick={() => setField("platforms", { ...(v.platforms || {}), instagram: !Boolean(v.platforms?.instagram) })} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${v.platforms?.instagram ? "bg-pink-600 text-white" : "bg-gray-700 text-gray-200"}`}>
              Instagram
            </button>
            <button type="button" aria-pressed={Boolean(v.platforms?.tiktok)} onClick={() => setField("platforms", { ...(v.platforms || {}), tiktok: !Boolean(v.platforms?.tiktok) })} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${v.platforms?.tiktok ? "bg-black text-white" : "bg-gray-700 text-gray-200"}`}>
              TikTok
            </button>
          </div>
        </div>

        <div className="mt-3">
          <label className="text-xs font-medium text-slate-400 mb-1 block">Video links / titles (optional)</label>
          <textarea rows={3} value={String(v.videoLinks ?? "")} onChange={(e) => setField("videoLinks", e.target.value)} placeholder="Paste links or titles for quick reference…" className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
        </div>

        <div className="mt-3">
          <label className="text-xs font-medium text-slate-400 mb-1 block">Notes / Content ideas</label>
          <textarea rows={3} value={String(v.videoNotes ?? "")} onChange={(e) => setField("videoNotes", e.target.value)} placeholder="Ideas, issues, or content plan…" className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
        </div>
      </section>
    );
  }

  type WednesdayLiveContent = {
    count?: number;
    durationMinutes?: number;
    platform?: "Facebook" | "Instagram" | "TikTok" | "Other";
    estimatedViewers?: number;
    leadsGenerated?: number;
    promoClipsPosted?: number;
    notes?: string;
  };

  function WednesdayLiveCard({ value, onChange }: { value?: WednesdayLiveContent; onChange: (v: WednesdayLiveContent) => void }) {
    const v = value || {};
    const update = (patch: Partial<WednesdayLiveContent>) => onChange({ ...v, ...patch });
    return (
      <section className={cardClasses + " p-5"}>
        <h3 className="text-lg font-semibold text-slate-100">Wednesday – Live sessions &amp; content output</h3>
        <p className="text-xs text-slate-400">Track live sessions with duration, platform and leads generated.</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-400">Live sessions hosted (count)</label>
            <input type="number" min={0} value={String(v.count ?? 0)} onChange={(e) => update({ count: Number((e.target as HTMLInputElement).value || 0) })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400">Session duration (minutes)</label>
            <input type="number" min={0} value={String(v.durationMinutes ?? 0)} onChange={(e) => update({ durationMinutes: Number((e.target as HTMLInputElement).value || 0) })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400">Platform</label>
            <select value={v.platform || "Facebook"} onChange={(e) => update({ platform: (e.target as HTMLSelectElement).value as any })} className="mt-1 rounded-lg border border-slate-700 bg-black/30 p-2 text-sm text-slate-100 w-full">
              <option>Facebook</option>
              <option>Instagram</option>
              <option>TikTok</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400">Estimated viewers</label>
            <input type="number" min={0} value={String(v.estimatedViewers ?? 0)} onChange={(e) => update({ estimatedViewers: Number((e.target as HTMLInputElement).value || 0) })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400">Leads generated from live</label>
            <input type="number" min={0} value={String(v.leadsGenerated ?? 0)} onChange={(e) => update({ leadsGenerated: Number((e.target as HTMLInputElement).value || 0) })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400">Promotional / product clips posted</label>
            <input type="number" min={0} value={String(v.promoClipsPosted ?? 0)} onChange={(e) => update({ promoClipsPosted: Number((e.target as HTMLInputElement).value || 0) })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400">Top-performing content / issues / ideas</label>
            <textarea rows={3} placeholder="Best clips, questions asked, or improvements for next live…" value={String(v.notes ?? "")} onChange={(e) => update({ notes: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>
        </div>
      </section>
    );
  }

  function ThursdayWeeklyCard({ value, onChange }: { value?: any; onChange: (v: any) => void }) {
    const v = value || {};
    const setField = (k: string, val: any) => onChange({ ...v, [k]: val });
    return (
      <section className={cardClasses + " p-5"}>
        <h3 className="text-lg font-semibold text-slate-100">Thursday – Weekly Marketing &amp; Office Ops</h3>
        <p className="mt-1 text-xs text-slate-400">Track meeting attendance, video shoot, content posted, and workspace organization.</p>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={Boolean(v.meetingAttended)} onChange={(e) => setField('meetingAttended', e.target.checked)} />
            <span className="text-sm text-slate-100">Weekly marketing meeting attended</span>
          </label>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={Boolean(v.videoShoot)} onChange={(e) => setField('videoShoot', e.target.checked)} />
            <span className="text-sm text-slate-100">Participated in weekly video shoot</span>
          </label>

          <div>
            <label className="text-sm font-medium text-slate-400 block mb-1">Number of videos participated in</label>
            <input type="number" min={0} value={String(v.videosParticipated ?? 0)} onChange={(e) => setField('videosParticipated', Number((e.target as HTMLInputElement).value || 0))} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={Boolean(v.officeClean)} onChange={(e) => setField('officeClean', e.target.checked)} />
            <span className="text-sm text-slate-100">Office / Display / Photo area cleaned &amp; organized</span>
          </label>

          <div>
            <label className="text-sm font-medium text-slate-400 block mb-1">Notes (challenges, highlights, ideas)</label>
            <textarea rows={3} placeholder="Notes (challenges, highlights, ideas)" value={String(v.thursdayNotes ?? '')} onChange={(e) => setField('thursdayNotes', e.target.value)} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>
        </div>
      </section>
    );
  }

  function FridayWeekendPrepCard({ value, onChange }: { value?: any; onChange: (v: any) => void }) {
    const v = value || {};
    const update = (patch: any) => onChange({ ...v, ...patch });
    return (
      <section className={cardClasses + " p-5"}>
        <h3 className="text-lg font-semibold text-slate-100">Friday – Weekend Content &amp; Store Prep</h3>
        <p className="mt-1 text-xs text-slate-400">Track videos posted, weekend promos, and workspace readiness.</p>

        <div className="mt-4 space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-400">Promotional / product videos posted</label>
            <input type="number" min={0} value={String(v.promoVideosPosted ?? 0)} onChange={(e) => update({ promoVideosPosted: Number((e.target as HTMLInputElement).value || 0) })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-400">Weekend promos prepared / posts scheduled</label>
            <input type="number" min={0} value={String(v.weekendPromosScheduled ?? 0)} onChange={(e) => update({ weekendPromosScheduled: Number((e.target as HTMLInputElement).value || 0) })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={Boolean(v.officeCleanOrganized)} onChange={(e) => update({ officeCleanOrganized: e.target.checked })} />
            <span className="text-sm text-slate-100">Office / display / photo area cleaned &amp; organized</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-slate-400">Notes (weekend plan, issues, ideas)</label>
            <textarea rows={3} placeholder="Key promos, reminders for Saturday/Monday…" value={String(v.notes ?? '')} onChange={(e) => update({ notes: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>
        </div>
      </section>
    );
  }

  function SaturdayLiveAndStoreCard({ value, onChange }: { value?: any; onChange: (v: any) => void }) {
    const v = value || {};
    const update = (patch: any) => onChange({ ...v, ...patch });
    return (
      <section className={cardClasses + " p-5"}>
        <h3 className="text-lg font-semibold text-slate-100">Saturday – Live Sessions &amp; Store Readiness</h3>
        <p className="mt-1 text-xs text-slate-400">Track live sessions and ensure the store is ready for the weekend.</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-400">Live sessions hosted (count)</label>
            <input type="number" min={0} value={String(v.count ?? 0)} onChange={(e) => update({ count: Number((e.target as HTMLInputElement).value || 0) })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400">Session duration (minutes)</label>
            <input type="number" min={0} value={String(v.durationMinutes ?? 0)} onChange={(e) => update({ durationMinutes: Number((e.target as HTMLInputElement).value || 0) })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400">Platform</label>
            <select value={v.platform || "Facebook"} onChange={(e) => update({ platform: (e.target as HTMLSelectElement).value as any })} className="mt-1 rounded-lg border border-slate-700 bg-black/30 p-2 text-sm text-slate-100 w-full">
              <option>Facebook</option>
              <option>Instagram</option>
              <option>TikTok</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400">Estimated viewers</label>
            <input type="number" min={0} value={String(v.estimatedViewers ?? 0)} onChange={(e) => update({ estimatedViewers: Number((e.target as HTMLInputElement).value || 0) })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400">Leads generated from live</label>
            <input type="number" min={0} value={String(v.leadsGenerated ?? 0)} onChange={(e) => update({ leadsGenerated: Number((e.target as HTMLInputElement).value || 0) })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={Boolean(v.officeCleanOrganized)} onChange={(e) => update({ officeCleanOrganized: e.target.checked })} />
            <span className="text-sm text-slate-100">Office / display / photo area cleaned &amp; organized</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-slate-400">Notes (highlights, issues, ideas)</label>
            <textarea rows={3} placeholder="Anything notable from today's live or store setup…" value={String(v.notes ?? '')} onChange={(e) => update({ notes: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
          </div>
        </div>
      </section>
    );
  }

  export default function DailyReportRedesign() {
    const [day, setDay] = useState<DayKey>("monday");
    const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

    const [dayState, setDayState] = useState<Record<DayKey, Record<string, any>>>(() => ({
      monday: {},
      tuesday: {},
      wednesday: {},
      thursday: {},
      friday: {},
      saturday: {},
    }));

    const [market, setMarket] = useState<Record<DayKey, MarketplaceState>>(() => ({
      monday: defaultMarketplaceState(),
      tuesday: defaultMarketplaceState(),
      wednesday: defaultMarketplaceState(),
      thursday: defaultMarketplaceState(),
      friday: defaultMarketplaceState(),
      saturday: defaultMarketplaceState(),
    }));

    const [customerComms, setCustomerComms] = useState<Record<DayKey, any>>(() => ({
      monday: {},
      tuesday: {},
      wednesday: {},
      thursday: {},
      friday: {},
      saturday: {},
    }));

    // helper mapping for weekday display and conditional rendering
    const currentDayName = useMemo(() => selectedDate.toLocaleDateString("en-US", { weekday: "long" }), [selectedDate]);

    useEffect(() => {
      // reset numeric fields when day changes to avoid stale values where intended
      // keep existing state but provide defaults for missing keys
      setDayState((prev) => ({
        ...prev,
        [day]: { ...(prev[day] || {}) },
      }));
    }, [day]);

    // basic submit handler that mirrors original payload structure
    const [busy, setBusy] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const gatherPayload = () => {
      const categories = {
        newUploads: Number(market[day].newUploaded) || 0,
        copiesUploaded: Number(market[day].copiesUploaded) || 0,
        productsEdited: Number(market[day].productsEdited) || 0,
      };

      const sales = (market[day].sales || []).map((s) => ({ id: s.id, productName: String(s.name || "").trim(), price: Number(s.price || 0), paymentMethod: s.paymentMethod || "", receiptNumber: s.receiptNumber || "", buyingPrice: Number((s.buyingPrice as any) || 0) }));

      const productsCount = categories.newUploads + categories.copiesUploaded + categories.productsEdited;
      const totalSales = sales.reduce((acc, s) => acc + (Number(s.price) || 0), 0);

      const body = {
        date: selectedDate.toISOString(),
        day,
        productsCount,
        totalSales,
        submittedBy: null,
        tasks: {
          categories,
          sales,
          marketplaceReview: market[day].review || undefined,
          customerComms: customerComms[day] || undefined,
          dayFields: dayState[day] || {},
        },
      };

      return body;
    };

    const handleSubmit = async () => {
      setBusy(true);
      setError(null);
      try {
        const body = gatherPayload();
        const res = await fetch("/api/daily-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setError(json?.error || `Server responded ${res.status}`);
        } else {
          setSuccess("Saved successfully");
          setTimeout(() => setSuccess(null), 4000);
        }
      } catch (err: any) {
        setError(err?.message || String(err));
      } finally {
        setBusy(false);
      }
    };

    // Simple autosave (debounced) – smaller than original to keep behavior predictable
    const autosaveTimer = useRef<number | null>(null);
    useEffect(() => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = window.setTimeout(() => {
        void (async () => {
          try {
            const body = gatherPayload();
            await fetch("/api/daily-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
          } catch (e) {
            // ignore autosave failures here; UI can surface save button errors
          }
        })();
      }, 1000) as unknown as number;
      return () => { if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current); };
    }, [dayState, market, customerComms, day, selectedDate]);

    // Build day navigation buttons like the original UI
    const dayKeys: DayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Daily Task Ops (Mon–Sat)</h1>
            <p className="text-sm text-slate-400">Redesigned form — preserves every field from the original daily entry.</p>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-2 w-full">
          {dayKeys.map((k) => {
            const isActive = day === k;
            const label = k.slice(0, 3).toUpperCase();
            return (
              <button key={k} onClick={() => setDay(k)} className={isActive ? "rounded-xl inline-flex items-center justify-center gap-2 text-xs border border-white/10 text-slate-200 bg-white/5 px-3 py-2" : "rounded-xl inline-flex items-center justify-center gap-2 text-xs border border-white/10 text-slate-300 bg-transparent hover:bg-white/5 px-3 py-2"}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Date & controls card */}
        <div className={cardClasses + " p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"}>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <label className="text-xs uppercase tracking-wide text-slate-400">Date</label>
            <div className="flex items-center gap-2">
              <CalendarIcon size={16} className="text-slate-400" />
              <input type="date" className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" value={selectedDate.toISOString().split("T")[0]} onChange={(e) => { const d = new Date(e.target.value); if (!isNaN(d.getTime())) setSelectedDate(d); }} />
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full md:w-auto">
            <label className="text-xs uppercase tracking-wide text-slate-400">Day of week</label>
            <select className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" value={currentDayName} onChange={(e) => {
              const nextDate = new Date(selectedDate);
              const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
              const cur = nextDate.getDay();
              const target = days.indexOf(e.target.value);
              const diff = target - cur;
              nextDate.setDate(nextDate.getDate() + diff);
              setSelectedDate(nextDate);
            }}>
              { ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d) => <option key={d} value={d}>{d}</option>) }
            </select>
          </div>

          <div className="flex items-end gap-4">
            <button type="button" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5" onClick={() => { setDayState({ monday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {}, saturday: {} }); setMarket({ monday: defaultMarketplaceState(), tuesday: defaultMarketplaceState(), wednesday: defaultMarketplaceState(), thursday: defaultMarketplaceState(), friday: defaultMarketplaceState(), saturday: defaultMarketplaceState() }); setCustomerComms({ monday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {}, saturday: {} }); }}>Reset day</button>
            <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95" onClick={handleSubmit} disabled={busy}>{busy ? 'Submitting...' : 'Submit report'}</button>
          </div>
        </div>

        {/* Main grid: receipts + marketplace + comms + day-specific cards */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              {/* Receipts & sales (left column) */}
              <section className={cardClasses + " p-5 mb-4"}>
                <h3 className="text-lg font-semibold">Receipts & Sales</h3>
                <p className="text-xs text-slate-400 mt-1">Add receipts and items sold (includes payment method and receipt numbers).</p>

                <div className="mt-4 space-y-4">
                  {(market[day].sales || []).map((row) => (
                    <div key={row.id} className={cardClasses + " p-4"}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-semibold">Receipt</div>
                          <div className="text-xs text-slate-400">Totals are calculated automatically.</div>
                        </div>
                        <div>
                          <button type="button" className="text-xs text-rose-400" onClick={() => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.filter((r) => r.id !== row.id) } }))}>Remove receipt</button>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-4 mt-4 items-center">
                        <div className="col-span-4">
                          <label className="text-xs font-medium text-slate-400 mb-1 block">Selling total (KES)</label>
                          <input type="number" value={row.price === "" ? "" : String(row.price)} onChange={(e) => { const raw = (e.target as HTMLInputElement).value; const parsed = raw === "" ? 0 : Number(raw); const safe = Number.isFinite(parsed) ? Math.max(0, parsed) : 0; setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => (r.id === row.id ? { ...r, price: safe } : r)) } })); }} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
                        </div>

                        <div className="col-span-5">
                          <label className="text-xs font-medium text-slate-400 mb-1 block">Receipt number</label>
                          <input value={row.receiptNumber || ''} onChange={(e) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => r.id === row.id ? { ...r, receiptNumber: (e.target as HTMLInputElement).value } : r) } }))} placeholder="Required" className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
                        </div>

                        <div className="col-span-3">
                          <label className="text-xs font-medium text-slate-400 mb-1 block">Payment method</label>
                          <div className="flex items-center gap-2 mt-2">
                            <button type="button" className={`px-3 py-1 rounded-full text-xs ${row.paymentMethod === 'MPESA' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-gray-200'}`} onClick={() => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => r.id === row.id ? { ...r, paymentMethod: 'MPESA' } : r) } }))}>MPESA</button>
                            <button type="button" className={`px-3 py-1 rounded-full text-xs ${row.paymentMethod === 'CASH' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-gray-200'}`} onClick={() => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => r.id === row.id ? { ...r, paymentMethod: 'CASH' } : r) } }))}>Cash</button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="text-sm font-medium">Products in this receipt</div>
                        <div className="mt-2 grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-8">
                            <label className="text-xs font-medium text-slate-400 mb-1 block">Product name</label>
                            <input placeholder="Product name" value={row.name || ''} onChange={(e) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => r.id === row.id ? { ...r, name: (e.target as HTMLInputElement).value } : r) } }))} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
                          </div>
                          <div className="col-span-3">
                            <label className="text-xs font-medium text-slate-400 mb-1 block">Buying price (KES)</label>
                            <input type="number" value={String((row as any).buyingPrice ?? '')} onChange={(e) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => r.id === row.id ? { ...r, buyingPrice: Number((e.target as HTMLInputElement).value || 0) } : r) } }))} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
                          </div>
                          <div className="col-span-1 flex items-center">
                            <button type="button" className="text-xs text-rose-400" onClick={() => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.filter((r) => r.id !== row.id) } }))}>Remove</button>
                          </div>
                        </div>
                        <div className="mt-3">
                          <button type="button" className="rounded-xl border border-white/10 text-slate-200 bg-transparent hover:bg-white/5 text-sm px-3 py-2 inline-flex items-center justify-center gap-2" onClick={() => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: [...prev[day].sales, { id: crypto.randomUUID(), name: '', price: '', paymentMethod: 'MPESA', receiptNumber: '' }] } }))}>+ Add product to this receipt</button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end">
                    <button type="button" className="rounded-xl px-4 py-2 bg-emerald-500 text-black font-semibold hover:brightness-95 text-sm" onClick={() => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: [...prev[day].sales, { id: crypto.randomUUID(), name: '', price: '' }] } }))}>Add row</button>
                  </div>
                </div>
              </section>

              {/* Notes / summary */}
              <section className={cardClasses + " p-5 mt-4"}>
                <label className="text-sm font-semibold">Notes / Summary</label>
                <textarea rows={4} value={String((dayState[day] || {}).notes ?? '')} onChange={(e) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], notes: e.target.value } }))} className="w-full rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 mt-2" placeholder="Any additional comments, highlights or issues…" />
              </section>
            </div>

            <div>
              {/* Marketplace review card */}
              <MarketplaceStockPricingCard value={market[day].review} onChange={(next) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], review: next } }))} />

              {/* Customer communications */}
              <div className="mt-4">
                <CustomerCommsActivityCard value={customerComms[day]} onChange={(next) => setCustomerComms((prev) => ({ ...prev, [day]: next }))} />
              </div>

              {/* Day-specific right column cards */}
              <div className="mt-4">
                {day === 'tuesday' && <ProductMarketingVideosCard value={dayState[day]} onChange={(next) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], ...next } }))} />}
                {day === 'wednesday' && <WednesdayLiveCard value={dayState[day]} onChange={(next) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], ...next } }))} />}
                {day === 'thursday' && <ThursdayWeeklyCard value={dayState[day]} onChange={(next) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], ...next } }))} />}
                {day === 'friday' && <FridayWeekendPrepCard value={dayState[day]} onChange={(next) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], ...next } }))} />}
                {day === 'saturday' && <SaturdayLiveAndStoreCard value={dayState[day]} onChange={(next) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], ...next } }))} />}
              </div>
            </div>
          </div>
        </div>

        {/* Save area */}
        <div className={cardClasses + " mt-4 flex gap-2 justify-end"}>
          <div className="flex items-center gap-3">
            {success ? <div className="p-2 rounded bg-emerald-900/10 text-emerald-300">{success}</div> : null}
            {error ? <div className="p-2 rounded bg-rose-900/10 text-rose-300">{error}</div> : null}
            <button className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5" onClick={() => { setDayState((s) => ({ ...s, [day]: {} })); setMarket((m) => ({ ...m, [day]: defaultMarketplaceState() })); setCustomerComms((c) => ({ ...c, [day]: {} })); }}>Reset day</button>
            <button className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95" onClick={handleSubmit} disabled={busy}>{busy ? 'Submitting...' : 'Submit report'}</button>
          </div>
        </div>
      </div>
    );
  }
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            onClick={() => {
              // reset logic would clear state here
              location.reload();
            }}
          >
            Reset day
          </button>
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95"
            onClick={handleSubmit}
          >
            Submit report
          </button>
        </div>
      </div>

      {/* Receipt entry */}
      <ReceiptSection />

      {/* Checklist sections */}
      {sections.map((sec) => (
        <DayChecklist key={sec.title} title={sec.title} items={sec.items} />
      ))}

      {/* Final notes textarea */}
      <div className={cardClasses + " p-6 space-y-2"}>
        <label className="text-sm font-semibold">Notes / Summary</label>
        <textarea
          rows={4}
          className="w-full rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Any additional comments, highlights or issues…"
        />
      </div>
    </div>
  );
}
