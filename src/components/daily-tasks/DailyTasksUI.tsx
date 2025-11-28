"use client"

import React, { useMemo, useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Button from "@/app/_components/Button";
import Card from "@/app/_components/Card";
import Input from "@/app/_components/Input";
import Checkbox from "@/app/_components/Checkbox";
import Textarea from "@/app/_components/Textarea";
import Sparkline from "@/app/_components/Sparkline";
import ProgressBar from "@/app/_components/ProgressBar";
import { computeUploadProgress } from "./utils";
import { CheckSquare, MessageSquare, Users, Lightbulb, ClipboardList } from "lucide-react";

// Marketplace review shops and types
type MarketplaceReview = {
  stockChecked: boolean;
  pricingConfirmed: boolean;
  competitorsReviewed: boolean;
  oosReviewed: boolean;
  notes: string;
};

type MarketplaceReviewState = Record<string, MarketplaceReview>;

// NOTE: `MarketplaceReviewSection` was removed — replaced by the
// `MarketplaceStockPricingCard` below which is the canonical implementation.

export type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

export type SaleRow = { id: string; name: string; price: number | "" };

export type MarketplaceState = {
  newUploaded: number | "";
  copiesUploaded: number | "";
  productsEdited: number | "";
  sales: SaleRow[];
  review?: Record<string, { stockChecked: boolean; pricingConfirmed: boolean; competitorsReviewed: boolean; oosReviewed: boolean; notes: string }>;
};

const defaultMarketplaceState = (): MarketplaceState => ({
  newUploaded: "",
  copiesUploaded: "",
  productsEdited: "",
  sales: [{ id: crypto.randomUUID(), name: "", price: "" }],
  review: undefined,
});

const marketplaceShops = [
  "Betech Store",
  "JM Collection",
  "Hitech Power",
  "Maxton",
  "Sky Store",
  "Betech Solar",
  "Kilimall",
];

type TaskField =
  | { kind: "check"; key: string; label: string }
  | { kind: "number"; key: string; label: string; min?: number; step?: number }
  | { kind: "text"; key: string; label: string; placeholder?: string };

type DayDefinition = {
  title: string;
  focus: string;
  targetUploads?: number;
  fields: TaskField[];
};

const shared: Record<string, TaskField> = {
  customersServed: { kind: "number", key: "customersServed", label: "Customers served (walk-in/online)", min: 0, step: 1 },
  commentsDMs: { kind: "number", key: "commentsDMs", label: "Engagements (comments/DMs)", min: 0, step: 1 },
  liveSessions: { kind: "number", key: "liveSessions", label: "Live sessions hosted", min: 0, step: 1 },
  leadsFollowed: { kind: "number", key: "leadsFollowed", label: "Leads followed-up", min: 0, step: 1 },
  officeClean: { kind: "check", key: "officeClean", label: "Office/display/photo area cleaned & organized" },
  competitorNotes: { kind: "text", key: "competitorNotes", label: "Notes on competitors / market observations", placeholder: "Pricing, offers, content ideas…" },
  improvementIdeas: { kind: "text", key: "improvementIdeas", label: "Improvement suggestions", placeholder: "Actionable ideas from the week/day" },
  meetingAttended: { kind: "check", key: "meetingAttended", label: "Weekly marketing meeting attended" },
  videoShoot: { kind: "check", key: "videoShoot", label: "Participated in weekly video shoot" },
  weekendPromos: { kind: "check", key: "weekendPromos", label: "Weekend promos prepared / posts scheduled" },
  stockChecked: { kind: "check", key: "stockChecked", label: "Stock & pricing confirmed (Jumia/Kilimall)" },
  inboxCleared: { kind: "check", key: "inboxCleared", label: "WhatsApp/calls/inquiries cleared" },
  // weeklySummary removed — Saturday now uses a dedicated card
};

export const dayTaskDefinitions: Record<DayKey, DayDefinition> = {
  monday: { title: "Monday", focus: "Product & Stock Management", targetUploads: 50, fields: [shared.stockChecked, shared.inboxCleared, shared.customersServed, shared.competitorNotes, shared.improvementIdeas] },
  tuesday: { title: "Tuesday", focus: "Product Marketing & Engagement", targetUploads: 50, fields: [shared.customersServed, shared.competitorNotes, shared.improvementIdeas] },
  wednesday: { title: "Wednesday", focus: "Live Session & Sales Day", targetUploads: 50, fields: [shared.leadsFollowed, shared.customersServed] },
  thursday: { title: "Thursday", focus: "Weekly Marketing & Video Shoot", targetUploads: 50, fields: [shared.meetingAttended, shared.videoShoot, shared.officeClean, shared.customersServed] },
  friday: { title: "Friday", focus: "Promotion & Sales Push", targetUploads: 50, fields: [shared.customersServed, shared.officeClean, shared.improvementIdeas] },
  saturday: { title: "Saturday", focus: "Customer Service & Summary", targetUploads: 50, fields: [shared.customersServed, shared.liveSessions, shared.officeClean, shared.leadsFollowed] },
};

const defaultDayState = (day: DayKey) => Object.fromEntries(dayTaskDefinitions[day].fields.map((f) => [f.key, f.kind === "number" ? 0 : f.kind === "check" ? false : ""])) as Record<string, number | boolean | string>;

export function computeAdminSummary(dayState: Record<string, number | boolean | string>, market: MarketplaceState) {
  const num = (k: string) => (typeof dayState[k] === "number" ? (dayState[k] as number) : 0);
  const yes = (k: string) => (typeof dayState[k] === "boolean" && (dayState[k] as boolean) ? 1 : 0);
  // mk_sales: count rows with non-empty name and a non-empty price
  const mk_sales = (market.sales || []).filter((r) => r.name && r.price !== "").length;
  // totalSalesKES: sum numeric prices; coerce strings and clamp negative to 0
  const totalSalesKES = (market.sales || []).reduce((acc, r) => {
    const p = Number((r.price as any) || 0);
    const valid = Number.isFinite(p) ? Math.max(0, p) : 0;
    return acc + valid;
  }, 0);

  return {
    videos: num("promoVideosPosted") + num("demoVideosRecorded"),
    lives: num("liveSessions") + num("liveSessionsTotal") + num("liveSessionsHosted"),
    leads: num("leadsFollowed"),
    customers: num("customersServed"),
    maintenance: yes("officeClean"),
    stockCheck: yes("stockChecked"),
    meeting: yes("meetingAttended"),
    videoShoot: yes("videoShoot"),
    weekendPrep: yes("weekendPromos"),
    mk_new: Number(market.newUploaded || 0),
    mk_copies: Number(market.copiesUploaded || 0),
    mk_edits: Number(market.productsEdited || 0),
    mk_sales,
    totalSalesKES,
  };
}

// Shop review types and helper
type Shops =
  | "Betech Store"
  | "JM Collection"
  | "Hitech Power"
  | "Maxton"
  | "Sky Store"
  | "Betech Solar"
  | "Kilimall";

type ShopReview = {
  stockChecked: boolean;
  pricingConfirmed: boolean;
  competitorsReviewed: boolean;
  oosReviewed: boolean;
  notes: string;
};

type MarketplaceShopReviewState = Record<Shops, ShopReview>;

const marketplaceShopsTyped: Shops[] = [
  "Betech Store",
  "JM Collection",
  "Hitech Power",
  "Maxton",
  "Sky Store",
  "Betech Solar",
  "Kilimall",
];

const defaultShopReview = (): ShopReview => ({ stockChecked: false, pricingConfirmed: false, competitorsReviewed: false, oosReviewed: false, notes: "" });

function MarketplaceStockPricingCard({ value, onChange }: { value?: Partial<Record<string, any>>; onChange: (next: MarketplaceShopReviewState) => void }) {
  const v = (value || {}) as Record<string, any>;
  const updateShop = (shop: Shops, patch: Partial<ShopReview>) => {
    onChange({
      // ensure we return a full typed record — callers often merge into tasks
      ...(marketplaceShopsTyped.reduce((acc, s) => ({ ...acc, [s]: { ...(v[s] || defaultShopReview()) } }), {} as any) as any),
      [shop]: { ...(v[shop] || defaultShopReview()), ...patch },
    });
  };

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-100">Marketplace stock &amp; pricing review</h3>
      <p className="mt-1 text-xs text-gray-400">Confirm stock, pricing, competitors &amp; out-of-stock per shop.</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {marketplaceShopsTyped.map((shop) => {
          const shopState: ShopReview = (v[shop] as ShopReview) ?? defaultShopReview();
          return (
            <div key={shop} className="space-y-2 rounded-xl border border-gray-800 bg-black/30 p-3">
              <h4 className="text-sm font-semibold text-gray-100">{shop}</h4>

              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={Boolean(shopState.stockChecked)}
                    onClick={() => updateShop(shop, { stockChecked: !Boolean(shopState.stockChecked) })}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${shopState.stockChecked ? "bg-emerald-600 text-white" : "bg-gray-700 text-gray-200"}`}
                  >
                    Stock
                  </button>
                  <span className="text-xs text-gray-200">Stock checked</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={Boolean(shopState.pricingConfirmed)}
                    onClick={() => updateShop(shop, { pricingConfirmed: !Boolean(shopState.pricingConfirmed) })}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${shopState.pricingConfirmed ? "bg-amber-500 text-white" : "bg-gray-700 text-gray-200"}`}
                  >
                    Price
                  </button>
                  <span className="text-xs text-gray-200">Pricing confirmed</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={Boolean(shopState.competitorsReviewed)}
                    onClick={() => updateShop(shop, { competitorsReviewed: !Boolean(shopState.competitorsReviewed) })}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${shopState.competitorsReviewed ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-200"}`}
                  >
                    Comp
                  </button>
                  <span className="text-xs text-gray-200">Competitors reviewed</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={Boolean(shopState.oosReviewed)}
                    onClick={() => updateShop(shop, { oosReviewed: !Boolean(shopState.oosReviewed) })}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${shopState.oosReviewed ? "bg-rose-600 text-white" : "bg-gray-700 text-gray-200"}`}
                  >
                    OOS
                  </button>
                  <span className="text-xs text-gray-200">OOS review</span>
                </div>
              </div>

              <div className="pt-1">
                <label className="text-[11px] font-medium text-gray-400">Notes</label>
                <textarea rows={2} className="mt-1 w-full rounded-lg border border-gray-800 bg-black/40 p-2 text-xs text-gray-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Key issues or actions for this shop…" value={String(shopState.notes ?? '')} onChange={(e) => updateShop(shop, { notes: e.target.value })} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CustomerCommsActivityCard({ value, onChange }: { value: any; onChange: (next: any) => void }) {
  if (!value) value = {};
  return (
    <section className="rounded-2xl border border-gray-700/30 p-3 bg-transparent">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Customer & Communications Activity</h3>
        <div className="text-xs opacity-70">Track walk-ins, messages and cleared inboxes</div>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <div className="space-y-2">
          <label className="text-xs">Walk-in served</label>
          <Input type="number" value={String(value.walkInServed ?? 0)} onChange={(e) => onChange({ ...value, walkInServed: Number((e.target as HTMLInputElement).value || 0) })} />
          <label className="text-xs">Online served</label>
          <Input type="number" value={String(value.onlineServed ?? 0)} onChange={(e) => onChange({ ...value, onlineServed: Number((e.target as HTMLInputElement).value || 0) })} />
          <label className="text-xs">Calls handled</label>
          <Input type="number" value={String(value.callsHandled ?? 0)} onChange={(e) => onChange({ ...value, callsHandled: Number((e.target as HTMLInputElement).value || 0) })} />
          <label className="text-xs">WhatsApp/SMS replied</label>
          <Input type="number" value={String(value.whatsappSmsReplied ?? 0)} onChange={(e) => onChange({ ...value, whatsappSmsReplied: Number((e.target as HTMLInputElement).value || 0) })} />
        </div>
        <div className="space-y-2">
          <label className="text-xs">FB comments replied</label>
          <Input type="number" value={String(value.fbCommentsReplied ?? 0)} onChange={(e) => onChange({ ...value, fbCommentsReplied: Number((e.target as HTMLInputElement).value || 0) })} />
          <label className="text-xs">FB DMs replied</label>
          <Input type="number" value={String(value.fbDmsReplied ?? 0)} onChange={(e) => onChange({ ...value, fbDmsReplied: Number((e.target as HTMLInputElement).value || 0) })} />
          <label className="text-xs">IG comments replied</label>
          <Input type="number" value={String(value.igCommentsReplied ?? 0)} onChange={(e) => onChange({ ...value, igCommentsReplied: Number((e.target as HTMLInputElement).value || 0) })} />
          <label className="text-xs">IG DMs replied</label>
          <Input type="number" value={String(value.igDmsReplied ?? 0)} onChange={(e) => onChange({ ...value, igDmsReplied: Number((e.target as HTMLInputElement).value || 0) })} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <div className="space-y-2">
          <label className="flex items-center gap-2"><Checkbox checked={Boolean(value.fbAllCleared)} onCheckedChange={(v) => onChange({ ...value, fbAllCleared: Boolean(v) })} /> <span className="text-sm">Facebook inbox cleared</span></label>
          <label className="flex items-center gap-2"><Checkbox checked={Boolean(value.igAllCleared)} onCheckedChange={(v) => onChange({ ...value, igAllCleared: Boolean(v) })} /> <span className="text-sm">Instagram inbox cleared</span></label>
        </div>
        <div className="space-y-2">
          <label className="text-xs">Competitor notes</label>
          <Textarea rows={3} value={String(value.competitorNotes ?? "")} onChange={(e) => onChange({ ...value, competitorNotes: e.target.value })} />
          <label className="text-xs">Improvement suggestions</label>
          <Textarea rows={3} value={String(value.improvementSuggestions ?? "")} onChange={(e) => onChange({ ...value, improvementSuggestions: e.target.value })} />
        </div>
      </div>
    </section>
  );
}

// TODO (Copilot):
// Replace the current Tuesday right-side box with a new combined card
// called "Product Marketing Output (Videos)". This card should collect:
//
// 1. Promotional/product videos posted (number input)
// 2. Product demo videos recorded (number input)
// 3. Platforms posted to (toggle chips: Facebook, Instagram, TikTok)
//    Use small rounded pill buttons styled like the Marketplace review pills.
// 4. Video links / titles (optional) -> small textarea
// 5. Notes / content ideas -> small textarea
//
// This replaces:
//   - Promotional/product videos posted
//   - Product demo video recorded
// And removes:
//   - Engagements (comments/DMs)
//
// Follow same styling used in Customer & Communications Activity.
// Use a 2-column layout for number inputs and full-width for textareas.
// Card styling: rounded-2xl, border-gray-800, bg-gray-900/40, p-5.
// Follow dark theme UI consistent with the rest of the dashboard.

function ProductMarketingVideosCard({ value, onChange }: { value?: any; onChange: (next: any) => void }) {
  const v = value || {};
  const setField = (key: string, val: any) => onChange({ ...v, [key]: val });

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-100">Product Marketing Output (Videos)</h3>
      <p className="mt-1 text-xs text-gray-400">Track promotional videos posted + demo videos recorded.</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs block mb-1">Promotional/product videos posted</label>
          <Input type="number" value={String(v.promoVideosPosted ?? 0)} onChange={(e) => setField("promoVideosPosted", Number((e.target as HTMLInputElement).value || 0))} />
        </div>
        <div>
          <label className="text-xs block mb-1">Product demo videos recorded</label>
          <Input type="number" value={String(v.demoVideosRecorded ?? 0)} onChange={(e) => setField("demoVideosRecorded", Number((e.target as HTMLInputElement).value || 0))} />
        </div>
      </div>

      <div className="mt-3">
        <div className="text-xs mb-2">Platforms posted to:</div>
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
        <label className="text-xs block mb-1">Video links / titles (optional)</label>
        <Textarea rows={3} value={String(v.videoLinks ?? "")} onChange={(e) => setField("videoLinks", e.target.value)} placeholder="Paste links or titles for quick reference…" />
      </div>

      <div className="mt-3">
        <label className="text-xs block mb-1">Notes / Content ideas</label>
        <Textarea rows={3} value={String(v.videoNotes ?? "")} onChange={(e) => setField("videoNotes", e.target.value)} placeholder="Ideas, issues, or content plan…" />
      </div>
    </section>
  );
}

// Types for Wednesday live card
type LivePlatforms = {
  facebook?: boolean;
  tiktok?: boolean;
  instagram?: boolean;
};

type WednesdayLiveContent = {
  liveSessionsTotal?: number;
  platforms?: LivePlatforms;
  promoClipsPosted?: number;
  leadsFollowedUp?: number;
  notes?: string;
};

function WednesdayLiveCard({ value, onChange }: { value?: WednesdayLiveContent; onChange: (v: WednesdayLiveContent) => void }) {
  const v = value || {};
  const update = (patch: Partial<WednesdayLiveContent>) => onChange({ ...v, ...patch });
  const updatePlatforms = (patch: Partial<LivePlatforms>) => update({ platforms: { ...(v.platforms || {}), ...patch } });

  const pillClass = (active?: boolean) =>
    `inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-300" : "border-gray-700 bg-black/40 text-gray-300"}`;

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-100">Wednesday – Live sessions &amp; content output</h3>
      <p className="text-xs text-gray-400">Track live sessions, promo clips and lead follow-ups.</p>

      <div className="mt-4 space-y-2">
        <label className="block text-sm font-medium text-gray-200">Live sessions hosted (total)</label>
        <Input type="number" min={0} value={String(v.liveSessionsTotal ?? 0)} onChange={(e) => update({ liveSessionsTotal: Number((e.target as HTMLInputElement).value || 0) })} />

        <div className="mt-2 text-xs font-medium text-gray-400">Platforms used</div>
        <div className="mt-1 flex flex-wrap gap-2">
          <button type="button" className={pillClass(Boolean(v.platforms?.facebook))} onClick={() => updatePlatforms({ facebook: !v.platforms?.facebook })}>
            Facebook
          </button>
          <button type="button" className={pillClass(Boolean(v.platforms?.tiktok))} onClick={() => updatePlatforms({ tiktok: !v.platforms?.tiktok })}>
            TikTok
          </button>
          <button type="button" className={pillClass(Boolean(v.platforms?.instagram))} onClick={() => updatePlatforms({ instagram: !v.platforms?.instagram })}>
            Instagram
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        <label className="block text-sm font-medium text-gray-200">Promotional / product clips posted</label>
        <Input type="number" min={0} value={String(v.promoClipsPosted ?? 0)} onChange={(e) => update({ promoClipsPosted: Number((e.target as HTMLInputElement).value || 0) })} />
      </div>

      <div className="mt-4 space-y-1">
        <label className="block text-sm font-medium text-gray-200">Leads followed-up from live sessions</label>
        <Input type="number" min={0} value={String(v.leadsFollowedUp ?? 0)} onChange={(e) => update({ leadsFollowedUp: Number((e.target as HTMLInputElement).value || 0) })} />
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-200">Top-performing content / issues / ideas</label>
        <Textarea rows={3} placeholder="Best clips, questions asked, or improvements for next live…" value={String(v.notes ?? "")} onChange={(e) => update({ notes: e.target.value })} />
      </div>
    </section>
  );
}

// TODO (Copilot) — THURSDAY RIGHT-SIDE CARD IMPLEMENTATION
//
// The Thursday layout should match Monday–Wednesday:
//   - Left column = Customer & Communications Activity (already correct)
//   - Right column = A full-height card titled "Thursday – Weekly Marketing & Office Ops"
//
// INSTRUCTIONS:
//
// 1. Replace the current single checkbox field on the right 
//    ("Weekly marketing meeting attended") with a full card component.
//
// 2. Wrap the Thursday content in a right-side <section> with the same 
//    container classes used for Tuesday/Wednesday:
//       className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 shadow-sm"
//
// 3. The card MUST appear in the right-hand grid column exactly like Tuesday/Wednesday.
//    Ensure the parent layout uses a 2-column grid such as:
//       grid grid-cols-1 lg:grid-cols-2 gap-6
//
// 4. Inside the right-column card, build the following fields:
//
//    Title: "Thursday – Weekly Marketing & Office Ops"
//    Subtitle: "Track meeting attendance, video shoot, content posted, and workspace organization."
//
//    Fields:
//    - Weekly marketing meeting attended  (checkbox)
//    - Participated in weekly video shoot (checkbox)
//    - Promotional / marketing video posted (number input)
//    - Office / Display / Photo area cleaned & organized (checkbox)
//    - Notes textarea (label: "Notes (challenges, highlights, ideas)")
//
// 5. Remove the old single checkbox entirely from the Thursday right side.
//
// 6. Match all inputs and checkboxes with the same style as:
//      • FB comments replied
//      • IG comments replied
//      • Instagram inbox cleared
//
// 7. Ensure the right-side Thursday card vertically aligns with the left card 
//    by using the same spacing (mt-6 where appropriate).
//
// 8. Keep the card responsive so on mobile it stacks under the left column.
//
// 9. Example wrapper for the right side:
//
// <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 shadow-sm">
//   ... Thursday fields ...
// </div>
//
// This ensures the Thursday card appears properly positioned on the RIGHT side.

function ThursdayWeeklyCard({ value, onChange }: { value?: any; onChange: (v: any) => void }) {
  const v = value || {};
  const setField = (k: string, val: any) => onChange({ ...v, [k]: val });

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-100">Thursday – Weekly Marketing &amp; Office Ops</h3>
      <p className="mt-1 text-xs text-gray-400">Track meeting attendance, video shoot, content posted, and workspace organization.</p>

      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-2">
          <Checkbox checked={Boolean(v.meetingAttended)} onCheckedChange={(val) => setField('meetingAttended', Boolean(val))} />
          <span className="text-sm">Weekly marketing meeting attended</span>
        </label>

        <label className="flex items-center gap-2">
          <Checkbox checked={Boolean(v.videoShoot)} onCheckedChange={(val) => setField('videoShoot', Boolean(val))} />
          <span className="text-sm">Participated in weekly video shoot</span>
        </label>

        <div>
          {/* Promotional / marketing videos removed from Thursday per request */}
        </div>

        <label className="flex items-center gap-2">
          <Checkbox checked={Boolean(v.officeClean)} onCheckedChange={(val) => setField('officeClean', Boolean(val))} />
          <span className="text-sm">Office / Display / Photo area cleaned &amp; organized</span>
        </label>

        <div>
          <label className="text-sm block mb-1">Notes (challenges, highlights, ideas)</label>
          <Textarea rows={3} placeholder="Notes (challenges, highlights, ideas)" value={String(v.thursdayNotes ?? '')} onChange={(e) => setField('thursdayNotes', e.target.value)} />
        </div>
      </div>
    </section>
  );
}

// Types for Friday weekend prep card
type FridayWeekendPrep = {
  promoVideosPosted?: number;
  weekendPromosScheduled?: number;
  officeCleanOrganized?: boolean;
  notes?: string;
};

function FridayWeekendPrepCard({ value, onChange }: { value?: FridayWeekendPrep; onChange: (v: FridayWeekendPrep) => void }) {
  const v = value || {};
  const update = (patch: Partial<FridayWeekendPrep>) => onChange({ ...v, ...patch });

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-100">Friday – Weekend Content &amp; Store Prep</h3>
      <p className="mt-1 text-xs text-gray-400">Track videos posted, weekend promos, and workspace readiness.</p>

      <div className="mt-4 space-y-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-200">Promotional / product videos posted</label>
          <Input type="number" min={0} value={String(v.promoVideosPosted ?? 0)} onChange={(e) => update({ promoVideosPosted: Number((e.target as HTMLInputElement).value || 0) })} />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-200">Weekend promos prepared / posts scheduled</label>
          <Input type="number" min={0} value={String(v.weekendPromosScheduled ?? 0)} onChange={(e) => update({ weekendPromosScheduled: Number((e.target as HTMLInputElement).value || 0) })} />
        </div>

        <label className="flex items-center gap-2">
          <Checkbox checked={Boolean(v.officeCleanOrganized)} onCheckedChange={(val) => update({ officeCleanOrganized: Boolean(val) })} />
          <span className="text-sm">Office / display / photo area cleaned &amp; organized</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-200">Notes (weekend plan, issues, ideas)</label>
          <Textarea rows={3} placeholder="Key promos, reminders for Saturday/Monday…" value={String(v.notes ?? '')} onChange={(e) => update({ notes: e.target.value })} />
        </div>
      </div>
    </section>
  );
}

// Types for Saturday live & store card
type SaturdayLiveAndStore = {
  liveSessionsHosted?: number;
  officeCleanOrganized?: boolean;
  notes?: string;
};

function SaturdayLiveAndStoreCard({ value, onChange }: { value?: SaturdayLiveAndStore; onChange: (v: SaturdayLiveAndStore) => void }) {
  const v = value || {};
  const update = (patch: Partial<SaturdayLiveAndStore>) => onChange({ ...v, ...patch });

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-100">Saturday – Live Sessions &amp; Store Readiness</h3>
      <p className="mt-1 text-xs text-gray-400">Track live sessions and ensure the store is ready for the weekend.</p>

      <div className="mt-4 space-y-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-200">Live sessions hosted</label>
          <Input type="number" min={0} value={String(v.liveSessionsHosted ?? 0)} onChange={(e) => update({ liveSessionsHosted: Number((e.target as HTMLInputElement).value || 0) })} />
        </div>

        <label className="flex items-center gap-2">
          <Checkbox checked={Boolean(v.officeCleanOrganized)} onCheckedChange={(val) => update({ officeCleanOrganized: Boolean(val) })} />
          <span className="text-sm">Office / display / photo area cleaned &amp; organized</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-200">Notes (highlights, issues, ideas)</label>
          <Textarea rows={3} placeholder="Anything notable from today's live or store setup…" value={String(v.notes ?? '')} onChange={(e) => update({ notes: e.target.value })} />
        </div>
      </div>
    </section>
  );
}

export default function DailyTasksUI() {
  const [day, setDay] = useState<DayKey>("monday");
  const [dayState, setDayState] = useState<Record<DayKey, Record<string, number | boolean | string>>>({
    monday: defaultDayState("monday"),
    tuesday: defaultDayState("tuesday"),
    wednesday: defaultDayState("wednesday"),
    thursday: defaultDayState("thursday"),
    friday: defaultDayState("friday"),
    saturday: defaultDayState("saturday"),
  });

  const [market, setMarket] = useState<Record<DayKey, MarketplaceState>>({
    monday: defaultMarketplaceState(),
    tuesday: defaultMarketplaceState(),
    wednesday: defaultMarketplaceState(),
    thursday: defaultMarketplaceState(),
    friday: defaultMarketplaceState(),
    saturday: defaultMarketplaceState(),
  });

  // Customer & Communications activity per day
  type CustomerCommsActivity = {
    walkInServed: number;
    onlineServed: number;
    callsHandled: number;
    whatsappSmsReplied: number;

    fbCommentsReplied: number;
    fbDmsReplied: number;
    igCommentsReplied: number;
    igDmsReplied: number;
    fbAllCleared: boolean;
    igAllCleared: boolean;

    competitorNotes: string;
    improvementSuggestions: string;
  };

  const defaultCustomerComms = (): CustomerCommsActivity => ({
    walkInServed: 0,
    onlineServed: 0,
    callsHandled: 0,
    whatsappSmsReplied: 0,
    fbCommentsReplied: 0,
    fbDmsReplied: 0,
    igCommentsReplied: 0,
    igDmsReplied: 0,
    fbAllCleared: false,
    igAllCleared: false,
    competitorNotes: "",
    improvementSuggestions: "",
  });

  const [customerComms, setCustomerComms] = useState<Record<DayKey, CustomerCommsActivity>>({
    monday: defaultCustomerComms(),
    tuesday: defaultCustomerComms(),
    wednesday: defaultCustomerComms(),
    thursday: defaultCustomerComms(),
    friday: defaultCustomerComms(),
    saturday: defaultCustomerComms(),
  });

  const def = dayTaskDefinitions[day];
  const adminSummary = useMemo(() => computeAdminSummary(dayState[day], market[day]), [day, dayState, market]);

  const productsCountCurrent = (Number(market[day].newUploaded || 0) + Number(market[day].copiesUploaded || 0) + Number(market[day].productsEdited || 0));
  const totalSalesCurrent = (market[day].sales || []).reduce((acc, s) => acc + (Number(s.price) || 0), 0);

  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitter, setSubmitter] = useState<string>(() => {
    try {
      return typeof window !== "undefined" ? (localStorage.getItem("betech_submitter") || "") : "";
    } catch {
      return "";
    }
  });

  // Try to derive submitter from next-auth session when available
  const _sess = useSession() as { data?: any } | undefined;
  const session = _sess?.data;

  useEffect(() => {
    if (!session) return;
    const name = session?.user?.name ?? session?.user?.email ?? "";
    if (name && name !== submitter) {
      setSubmitter(name);
      try {
        localStorage.setItem("betech_submitter", name);
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Derive the overall `stockChecked` flag for the day from per-shop review.
  // The derived flag is true only when every configured shop has both
  // `stockChecked` AND `pricingConfirmed` set to true. This keeps backward
  // compatibility with the older `stockChecked` day field used by exports.
  useEffect(() => {
    try {
      const review = market[day].review as Partial<Record<string, ShopReview>> | undefined;
      let derived = false;
      if (review) {
        derived = marketplaceShopsTyped.every((s) => Boolean((review as any)[s]?.stockChecked) && Boolean((review as any)[s]?.pricingConfirmed));
      }
      setDayState((prev) => {
        if (prev[day] && prev[day]["stockChecked"] === derived) return prev;
        return { ...prev, [day]: { ...prev[day], stockChecked: derived } };
      });
    } catch (e) {
      // defensive: don't crash the UI
    }
    // only watch market[day] and day
  }, [market, day]);
  const autosaveTimer = useRef<number | null>(null);
  const lastAutoSaved = useRef<string | null>(null);
  const isAutoSaving = useRef(false);
  const pendingAutosave = useRef(false);
  const autosaveRetryTimer = useRef<number | null>(null);
  const autosaveRetryCount = useRef(0);
  const [autosaveStatus, setAutosaveStatus] = useState<string | null>(null);
  const [salesErrors, setSalesErrors] = useState<Record<string, string | null>>({});

  const validatePayload = (body: any) => {
    if (!body.day) return "day is required";
    if (body.productsCount < 0) return "productsCount must be >= 0";
    if (body.totalSales < 0) return "totalSales must be >= 0";
    if (!Array.isArray(body.tasks.sales)) return "sales must be an array";
    if (body.tasks.marketplaceReview && typeof body.tasks.marketplaceReview !== "object") return "marketplaceReview must be object";
    if (body.tasks.customerComms && typeof body.tasks.customerComms !== "object") return "customerComms must be object";
    if (body.submittedBy && typeof body.submittedBy !== "string") return "submittedBy must be a string";
    for (const s of body.tasks.sales) {
      if (typeof s.productName !== "string") return "each sale must have a productName";
      if (Number(s.price) < 0) return "sale price must be >= 0";
    }
    return null;
  };

  const handleSave = async () => {
    setBusy(true);
    setSuccess(null);
    setError(null);
    try {
      // build tasks payload expected by server/export
      const categories = {
        newUploads: Number(market[day].newUploaded) || 0,
        copiesUploaded: Number(market[day].copiesUploaded) || 0,
        productsEdited: Number(market[day].productsEdited) || 0,
      };
      const marketing = {
        attendedMarketingMeeting: Boolean(dayState[day]["meetingAttended"]),
        participatedVideoShoot: Boolean(dayState[day]["videoShoot"]),
        marketingVideosShot: (Number(dayState[day]["promoVideosPosted"]) || 0) + (Number(dayState[day]["demoVideosRecorded"]) || 0),
      };
      const customerOperations = {
        walkInCustomers: Number(dayState[day]["customersServed"]) || 0,
        customersPurchased: 0,
        liveViewers: Number(dayState[day]["liveSessions"]) || 0,
        livePurchases: 0,
      };
      const officeMaintenance = {
        officeCleaned: Boolean(dayState[day]["officeClean"]),
        officeNotes: String((dayState[day]["competitorNotes"] || "").toString().trim()),
      };

      // include marketplace review data (per-shop) if present
      const marketplaceReview = market[day].review || undefined;
      // include customer & communications activity for the day
      const customerCommsForDay = customerComms[day] || undefined;

      // Trim improvement ideas for saved payload
      const trimmedDayFields = { ...dayState[day], competitorNotes: String((dayState[day]["competitorNotes"] || "")).trim(), improvementIdeas: String((dayState[day]["improvementIdeas"] || "")).trim() };

      // build & filter sales: keep rows only when name non-empty AND price > 0
      const rawSales = (market[day].sales || []).map((s) => ({ id: s.id, productName: String(s.name || "").trim(), price: Number(s.price || 0) }));

      // validate sales rows: each row must either be fully empty or have both name and price>0
      const newSalesErrors: Record<string, string | null> = {};
      for (const s of rawSales) {
        const hasName = s.productName !== "";
        const hasPrice = Number(s.price) > 0;
        if (hasName && !hasPrice) newSalesErrors[s.id] = "Enter a valid price (> 0) or remove row";
        else if (!hasName && hasPrice) newSalesErrors[s.id] = "Enter product name or clear price";
        else newSalesErrors[s.id] = null;
      }
      setSalesErrors(newSalesErrors);

      const sales = rawSales.filter((s) => s.productName !== "" && Number(s.price) > 0);

      const productsCount = categories.newUploads + categories.copiesUploaded + categories.productsEdited;
      const totalSales = sales.reduce((acc, s) => acc + (Number(s.price) || 0), 0);

      const body = {
        date: new Date().toISOString(),
        day,
        productsCount,
        totalSales,
        submittedBy: submitter || null,
        tasks: {
          categories,
          marketing,
          customerOperations,
          officeMaintenance,
          marketplaceReview,
          customerComms: customerCommsForDay,
          sales,
          // include trimmed fields in dayFields for completeness
          dayFields: trimmedDayFields,
        },
      };

      // Block save if any sales row is invalid
      const hasSalesError = Object.values(salesErrors).some((v) => v);
      if (hasSalesError) {
        setError("Please fix sales rows before saving");
        setBusy(false);
        return;
      }

      const validationErr = validatePayload(body);
      if (validationErr) {
        setError(validationErr);
        setBusy(false);
        return;
      }

      const res = await fetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || `Server responded ${res.status}`);
        // keep error and allow user to retry
      } else {
        setSuccess("Saved successfully");
        // optionally clear the day's inputs
        // setDayState((s) => ({ ...s, [day]: defaultDayState(day) }));
        // setMarket((m) => ({ ...m, [day]: defaultMarketplaceState() }));
        // auto-dismiss success after a short time
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRetry = () => {
    // simple retry invokes handleSave again
    handleSave();
  };

  // Auto-save: debounce when dayState or market changes
  useEffect(() => {
    const snapshot = JSON.stringify({ day, dayState: dayState[day], market: market[day] });
    if (lastAutoSaved.current === snapshot) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);

    const backoffs = [1500, 3000, 6000];

    autosaveTimer.current = window.setTimeout(() => {
      // don't start a new autosave if one is already running
      if (isAutoSaving.current) {
        pendingAutosave.current = true;
        return;
      }
      isAutoSaving.current = true;
      setAutosaveStatus("saving");

      const doAutosave = async () => {
        try {
          const categories = {
            newUploads: Number(market[day].newUploaded) || 0,
            copiesUploaded: Number(market[day].copiesUploaded) || 0,
            productsEdited: Number(market[day].productsEdited) || 0,
          };
          const marketing = {
            attendedMarketingMeeting: Boolean(dayState[day]["meetingAttended"]),
            participatedVideoShoot: Boolean(dayState[day]["videoShoot"]),
            marketingVideosShot: (Number(dayState[day]["promoVideosPosted"]) || 0) + (Number(dayState[day]["demoVideosRecorded"]) || 0),
          };
          const customerOperations = {
            walkInCustomers: Number(dayState[day]["customersServed"]) || 0,
            customersPurchased: 0,
            liveViewers: Number(dayState[day]["liveSessions"]) || 0,
            livePurchases: 0,
          };
          const officeMaintenance = {
            officeCleaned: Boolean(dayState[day]["officeClean"]),
            officeNotes: String((dayState[day]["competitorNotes"] || "").toString().trim()),
          };
          const sales = (market[day].sales || [])
            .map((s) => ({ productName: String(s.name || "").trim(), price: Number(s.price || 0) }))
            .filter((s) => s.productName !== "" && Number(s.price) > 0);

          const productsCount = categories.newUploads + categories.copiesUploaded + categories.productsEdited;
          const totalSales = sales.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
          const trimmedDayFields = { ...dayState[day], competitorNotes: String((dayState[day]["competitorNotes"] || "")).trim(), improvementIdeas: String((dayState[day]["improvementIdeas"] || "")).trim() };

          const marketplaceReview = market[day].review || undefined;
          const customerCommsForDay = customerComms[day] || undefined;

          const body = {
            date: new Date().toISOString(),
            day,
            productsCount,
            totalSales,
            submittedBy: submitter || null,
            tasks: {
              categories,
              marketing,
              customerOperations,
              officeMaintenance,
              sales,
              dayFields: trimmedDayFields,
              marketplaceReview,
              customerComms: customerCommsForDay,
            },
          };

            const validationErr = validatePayload(body);
            if (validationErr) {
              setAutosaveStatus(null);
              return;
            }

            // if any sales row is invalid, abort autosave and set status
            const rawSalesForCheck = (market[day].sales || []).map((s) => ({ id: s.id, productName: String(s.name || "").trim(), price: Number(s.price || 0) }));
            for (const s of rawSalesForCheck) {
              const hasName = s.productName !== "";
              const hasPrice = Number(s.price) > 0;
              if ((hasName && !hasPrice) || (!hasName && hasPrice)) {
                setAutosaveStatus("Autosave paused — fix sales rows");
                // store errors for UI
                setSalesErrors((prev) => ({ ...prev, [s.id]: hasName && !hasPrice ? "Enter a valid price (> 0) or remove row" : "Enter product name or clear price" }));
                isAutoSaving.current = false;
                return;
              }
            }

          const res = await fetch("/api/daily-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(`Autosave failed ${res.status}`);

          lastAutoSaved.current = snapshot;
          const now = new Date();
          setSavedAt(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
          setAutosaveStatus("saved");
          autosaveRetryCount.current = 0;
          if (pendingAutosave.current) {
            pendingAutosave.current = false;
            // Immediately trigger another autosave cycle
            if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
            autosaveTimer.current = window.setTimeout(() => {}, 50);
          }
        } catch (err) {
          if (autosaveRetryCount.current < backoffs.length) {
            autosaveRetryCount.current += 1;
            setAutosaveStatus("Autosave failed — retrying...");
            const wait = backoffs[autosaveRetryCount.current - 1];
            if (autosaveRetryTimer.current) window.clearTimeout(autosaveRetryTimer.current);
            autosaveRetryTimer.current = window.setTimeout(() => {
              void doAutosave();
            }, wait);
          } else {
            setAutosaveStatus("Autosave paused");
          }
        } finally {
          isAutoSaving.current = false;
        }
      };

      void doAutosave();
    }, 700);

    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
      if (autosaveRetryTimer.current) window.clearTimeout(autosaveRetryTimer.current);
      autosaveRetryCount.current = 0;
      pendingAutosave.current = false;
      isAutoSaving.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayState, market, day]);

  return (
    <div className="w-full p-6 space-y-6">
      {success ? (
        <div className="p-3 rounded bg-emerald-900/10 text-emerald-300">{success}</div>
      ) : null}
      {error ? (
        <div className="p-3 rounded bg-rose-900/10 text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleRetry}>Retry</Button>
          </div>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Daily Task Categories (Mon–Sat)</h1>
          <p className="text-sm opacity-80">Core duties + Jumia/Kilimall operations are captured for EVERY day.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            aria-label="Your name"
            placeholder="Your name (optional)"
            value={submitter}
            onChange={(e) => {
              const v = e.target.value;
              setSubmitter(v);
              try {
                localStorage.setItem("betech_submitter", v);
              } catch {}
            }}
            className="text-sm px-2 py-1 rounded bg-gray-800 border border-gray-700/40"
          />
          <Button
            variant="secondary"
            onClick={() => {
              const url = submitter ? `/admin/daily-report?user=${encodeURIComponent(submitter)}` : "/admin/daily-report";
              window.open(url, "_blank");
            }}
            className="text-sm"
          >
            View admin reports
          </Button>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="kpi-card">
          <div className="kpi-title">Products (today)</div>
          <div className="kpi-value">{productsCountCurrent}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title">Total sales (KES)</div>
          <div className="kpi-value">{totalSalesCurrent.toLocaleString()}</div>
        </div>
        <div className="ml-4 text-sm opacity-70">Trend</div>
        <div className="sparkline">
          <Sparkline values={[adminSummary.mk_new as number, adminSummary.mk_copies as number, adminSummary.mk_edits as number, adminSummary.mk_sales as number, adminSummary.videos as number, adminSummary.leads as number]} color="var(--primary)" />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2 w-full">
        {Object.keys(dayTaskDefinitions).map((k) => {
          const isActive = day === k;
          return (
            <Button
              key={k}
              onClick={() => setDay(k as DayKey)}
              variant={isActive ? "secondary" : "secondary"}
              className={`py-2 px-3 text-xs ${isActive ? "tab-active" : "text-gray-300 hover:text-[var(--betech-orange)]"}`}
            >
              {dayTaskDefinitions[k as DayKey].title.slice(0, 3)}
            </Button>
          );
        })}
      </div>

      <div className="space-y-6">
        <Card className="shadow-none p-4 bg-transparent border border-gray-700/30">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{def.title}</h2>
              <p className="text-sm opacity-70">Focus: {def.focus}</p>
            </div>
            {def.targetUploads ? (
              <div className="text-xs">
                <div>Target uploads: {def.targetUploads}/day</div>
                <div className="w-40 mt-1 bg-white/5 rounded-full h-2 overflow-hidden">
                          {(() => {
                            const { uploadsToday } = computeUploadProgress(market[day], def.targetUploads || 1);
                            return <ProgressBar value={uploadsToday} max={def.targetUploads || 1} label={`Target uploads (${def.targetUploads}/day)`} />;
                          })()}
                </div>
              </div>
            ) : null}
          </div>

          {/* Marketplace block placed above task fields for visual priority */}
          <Card className="mt-4 bg-transparent space-y-4 p-4 border border-gray-700/30 shadow-none">
            <h3 className="font-semibold text-sm">Jumia / Kilimall Operations</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <LabeledNumber label="New products uploaded" value={market[day].newUploaded} onChange={(v) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], newUploaded: v } }))} />
              <LabeledNumber label="Copies of products uploaded" value={market[day].copiesUploaded} onChange={(v) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], copiesUploaded: v } }))} />
              <LabeledNumber label="Products edited" value={market[day].productsEdited} onChange={(v) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], productsEdited: v } }))} />
            </div>

            <div className="space-y-2 mt-3">
              <div className="text-sm font-medium">Sales Records</div>
              {market[day].sales.map((row) => (
                <div key={row.id} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-6">
                    <label htmlFor={`sale-name-${row.id}`} className="text-xs mb-1 block">Product</label>
                    <Input id={`sale-name-${row.id}`} placeholder="Solar Panel 200W" value={row.name} onChange={(e) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => (r.id === row.id ? { ...r, name: (e.target as HTMLInputElement).value } : r)) } }))} />
                    {salesErrors[row.id] ? <div className="text-xs text-rose-400 mt-1">{salesErrors[row.id]}</div> : null}
                  </div>
                  <div className="col-span-4">
                    <label htmlFor={`sale-price-${row.id}`} className="text-xs mb-1 block">Price (KES)</label>
                    <Input
                      id={`sale-price-${row.id}`}
                      className="w-full"
                      type="number"
                      placeholder="12500"
                      value={row.price === "" ? "" : String(row.price)}
                      onChange={(e) => {
                        const raw = (e.target as HTMLInputElement).value;
                        const parsed = raw === "" ? 0 : Number(raw);
                        const safe = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
                        setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => (r.id === row.id ? { ...r, price: safe } : r)) } }));
                      }}
                      onKeyDown={(e) => {
                        const isLast = market[day].sales[market[day].sales.length - 1]?.id === row.id;
                        if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && isLast) {
                          setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: [...prev[day].sales, { id: crypto.randomUUID(), name: "", price: "" }] } }));
                        }
                      }}
                    />
                  </div>
                  <div className="col-span-2 pt-6">
                    <Button variant="danger" onClick={() => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.filter((r) => r.id !== row.id) } }))}>Remove</Button>
                  </div>
                </div>
              ))}

               <div className="flex justify-end">
                 <Button onClick={() => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: [...prev[day].sales, { id: crypto.randomUUID(), name: "", price: "" }] } }))}>Add row</Button>
               </div>
            </div>
          </Card>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
            {(() => {
              // Render the CustomerCommsActivityCard and (for Tuesday) the
              // ProductMarketingVideosCard in place of individual promo/demo fields.
              const skipKeys = new Set(["customersServed", "inboxCleared", "competitorNotes", "improvementIdeas"]);
              if (day === "tuesday") {
                // promo/demo handled by ProductMarketingVideosCard
                skipKeys.add("demoRecorded");
                skipKeys.add("commentsDMs");
              }
              if (day === "wednesday") {
                // we render the WednesdayLiveCard so skip the old liveSessions field
                skipKeys.add("liveSessions");
              }
              if (day === "thursday") {
                // We'll render a full Thursday weekly card on the right; skip the individual fields
                skipKeys.add("meetingAttended");
                skipKeys.add("videoShoot");
                skipKeys.add("officeClean");
              }
              if (day === "friday") {
                // We'll render a full Friday weekend prep card on the right; skip the individual fields
                skipKeys.add("weekendPromos");
                skipKeys.add("officeClean");
              }
              if (day === "saturday") {
                // We'll render a full Saturday live & store card on the right; skip legacy fields
                skipKeys.add("liveSessions");
                skipKeys.add("officeClean");
                skipKeys.add("weeklySummary");
              }

              return (
                <>
                  <div className="w-full">
                    <CustomerCommsActivityCard
                      value={customerComms[day]}
                      onChange={(next) => setCustomerComms((prev) => ({ ...prev, [day]: next }))}
                    />
                  </div>

                  {day === "tuesday" && (
                    <div className="w-full">
                      <ProductMarketingVideosCard
                        value={dayState[day]}
                        onChange={(next) =>
                          setDayState((prev) => {
                            const platforms = (next as any).platforms || {};
                            const flattened = {
                              platforms_facebook: Boolean(platforms.facebook),
                              platforms_instagram: Boolean(platforms.instagram),
                              platforms_tiktok: Boolean(platforms.tiktok),
                            };
                            const rest = { ...next } as any;
                            delete rest.platforms;
                            // prefer new keys `promoVideosPosted` and `demoVideosRecorded`
                            return { ...prev, [day]: { ...prev[day], ...rest, ...flattened } };
                          })
                        }
                      />
                    </div>
                  )}

                  {day === "wednesday" && (
                    <div className="w-full">
                      <WednesdayLiveCard
                        value={dayState[day] as any}
                        onChange={(next) =>
                          setDayState((prev) => {
                            const platforms = (next as any).platforms || {};
                            const flattened = {
                              platforms_facebook: Boolean(platforms.facebook),
                              platforms_instagram: Boolean(platforms.instagram),
                              platforms_tiktok: Boolean(platforms.tiktok),
                            };
                            const rest = { ...next } as any;
                            delete rest.platforms;
                            return { ...prev, [day]: { ...prev[day], ...rest, ...flattened } };
                          })
                        }
                      />
                    </div>
                  )}

                  {day === "thursday" && (
                    <div className="w-full">
                      <ThursdayWeeklyCard
                        value={dayState[day] as any}
                        onChange={(next) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], ...next } }))}
                      />
                    </div>
                  )}

                  {day === "friday" && (
                    <div className="w-full">
                      <FridayWeekendPrepCard
                        value={dayState[day] as any}
                        onChange={(next) =>
                          setDayState((prev) => ({
                        ...prev,
                        [day]: {
                          ...prev[day],
                          // write new keys produced by the Friday card
                          promoVideosPosted: Number((next as any).promoVideosPosted ?? 0),
                          weekendPromosScheduled: Number((next as any).weekendPromosScheduled ?? 0),
                          officeCleanOrganized: Boolean((next as any).officeCleanOrganized ?? false),
                          weekendNotes: String((next as any).notes ?? ""),
                          ...next,
                        },
                      }))
                        }
                      />
                    </div>
                  )}

                  {day === "saturday" && (
                    <div className="w-full">
                      <SaturdayLiveAndStoreCard
                        value={dayState[day] as any}
                        onChange={(next) =>
                          setDayState((prev) => ({
                            ...prev,
                            [day]: {
                              ...prev[day],
                              liveSessionsHosted: Number((next as any).liveSessionsHosted ?? 0),
                              officeCleanOrganized: Boolean((next as any).officeCleanOrganized ?? false),
                              saturdayNotes: String((next as any).notes ?? ""),
                              ...next,
                            },
                          }))
                        }
                      />
                    </div>
                  )}

                  {def.fields.map((f) => {
                    if (skipKeys.has(f.key)) return null;
                    // Replace the single stockChecked checkbox with the per-shop card
                    if (f.kind === "check" && f.key === "stockChecked") {
                      return (
                        <div key={f.key} className="w-full">
                          <MarketplaceStockPricingCard
                            value={market[day].review}
                            onChange={(next) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], review: next } }))}
                          />
                        </div>
                      );
                    }

                    return (
                      <div key={f.key} className="flex items-start gap-3 p-3 rounded-2xl border border-gray-700/30">
                        {f.kind === "check" && (
                          <label className="flex items-center gap-2">
                            <Checkbox checked={Boolean(dayState[day][f.key])} onCheckedChange={(v) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], [f.key]: v } }))} />
                            <span className="text-sm flex items-center gap-2">
                              {renderIconForKey(f.key)}
                              <span>{f.label}</span>
                            </span>
                          </label>
                        )}
                        {f.kind === "number" && (
                          <div className="w-full">
                            <label className="text-sm block mb-1 flex items-center gap-2">{renderIconForKey(f.key)}{f.label}</label>
                            <Input type="number" min={f.min} step={f.step} value={String(dayState[day][f.key] || 0)} onChange={(e) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], [f.key]: Number((e.target as HTMLInputElement).value) } }))} />
                          </div>
                        )}
                        {f.kind === "text" && (
                          <div className="w-full">
                            <label className="text-sm block mb-1 flex items-center gap-2">{renderIconForKey(f.key)}{f.label}</label>
                            <Textarea rows={3} className="" placeholder={f.placeholder} value={String(dayState[day][f.key] || "")} onChange={(e) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], [f.key]: e.target.value } }))} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>

          <Card className="mt-4 p-4 space-y-3 bg-transparent border border-gray-700/30 shadow-none">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Admin Summary (collapsed fields)</h3>
              <div className="text-xs opacity-70">Auto‑computed</div>
            </div>

            <div className="grid md:grid-cols-5 gap-3 text-sm">
              <SummaryItem label="Videos" value={adminSummary.videos} />
              <SummaryItem label="Live Sessions" value={adminSummary.lives} />
              <SummaryItem label="Leads" value={adminSummary.leads} />
              <SummaryItem label="Customers" value={adminSummary.customers} />
              <SummaryItem label="Maintenance" value={adminSummary.maintenance ? "Yes" : "No"} />
            </div>

            <div className="grid md:grid-cols-4 gap-3 text-sm mt-3">
              <SummaryItem label="Mk New" value={adminSummary.mk_new as number} />
              <SummaryItem label="Mk Copies" value={adminSummary.mk_copies as number} />
              <SummaryItem label="Mk Edits" value={adminSummary.mk_edits as number} />
              <SummaryItem label="Mk Sales Rows" value={adminSummary.mk_sales as number} />
            </div>

            <div className="mt-3 text-sm">
              <div className="text-xs opacity-70 mb-1">Total Sales (KES)</div>
              <div className="font-semibold">KES {Number(adminSummary.totalSalesKES || 0).toLocaleString()}</div>
            </div>
          </Card>

            <Card className="mt-4 p-3 flex gap-2 justify-end border border-gray-700/30 shadow-none">
              <Button variant="secondary" onClick={() => { setDayState((s) => ({ ...s, [day]: defaultDayState(day) })); setMarket((m) => ({ ...m, [day]: defaultMarketplaceState() })); }}>Reset day</Button>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-400" aria-live="polite">
                    {autosaveStatus === "saved" && savedAt ? `Saved at ${savedAt}` : autosaveStatus}
                  </div>
                  <Button variant="secondary" onClick={() => window.open('/admin/daily-report', '_blank')}>
                    View admin reports
                  </Button>
                  <Button onClick={busy ? undefined : handleSave}>{busy ? "Saving..." : "Save"}</Button>
                </div>
            </Card>
        </Card>
      </div>
    </div>
  );
}

const SummaryItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="p-3 rounded-xl border border-gray-700/30 bg-transparent">
    <div className="text-[11px] opacity-70 mb-1">{label}</div>
    <div className="font-semibold">{value}</div>
  </div>
);

const LabeledNumber: React.FC<{ label: string; value: number | ""; onChange: (v: number | "") => void }> = ({ label, value, onChange }) => (
  <div>
    <label className="text-sm block mb-1">{label}</label>
    <Input type="number" value={value === "" ? "" : String(value)} onChange={(e) => onChange((e.target as HTMLInputElement).value === "" ? "" : Number((e.target as HTMLInputElement).value))} />
  </div>
);

// Uses shared Sparkline component from `_components`

function renderIconForKey(key: string) {
  // map a few common keys to icons
  switch (key) {
    case "demoRecorded":
    case "demoVideosRecorded":
    case "officeClean":
      return <CheckSquare className="w-4 h-4 opacity-80" />;
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
