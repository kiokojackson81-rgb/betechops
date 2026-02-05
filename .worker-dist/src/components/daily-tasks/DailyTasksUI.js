"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dayTaskDefinitions = void 0;
exports.computeAdminSummary = computeAdminSummary;
exports.default = DailyTasksUI;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_2 = require("next-auth/react");
const Button_1 = __importDefault(require("@/app/_components/Button"));
const Card_1 = __importDefault(require("@/app/_components/Card"));
const Input_1 = __importDefault(require("@/app/_components/Input"));
const Checkbox_1 = __importDefault(require("@/app/_components/Checkbox"));
const Textarea_1 = __importDefault(require("@/app/_components/Textarea"));
const ProgressBar_1 = __importDefault(require("@/app/_components/ProgressBar"));
const utils_1 = require("./utils");
const lucide_react_1 = require("lucide-react");
const defaultMarketplaceState = () => ({
    newUploaded: "",
    copiesUploaded: "",
    productsEdited: "",
    sales: [{ id: crypto.randomUUID(), name: "", price: "", paymentMethod: "MPESA", receiptNumber: "" }],
    review: undefined,
});
const cardClasses = "rounded-2xl p-4 border border-white/10 bg-[var(--card,#171b23)] border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20";
const marketplaceShops = [
    "Betech Store",
    "JM Collection",
    "Hitech Power",
    "Maxton",
    "Sky Store",
    "Betech Solar",
    "Kilimall",
];
const shared = {
    customersServed: { kind: "number", key: "customersServed", label: "Customers served (walk-in/online)", min: 0, step: 1 },
    commentsDMs: { kind: "number", key: "commentsDMs", label: "Engagements (comments/DMs)", min: 0, step: 1 },
    liveSessions: { kind: "number", key: "liveSessions", label: "Live sessions hosted", min: 0, step: 1 },
    // legacy numeric `leadsFollowed` removed — richer live session objects are used instead
    officeClean: { kind: "check", key: "officeClean", label: "Office/display/photo area cleaned & organized" },
    videosParticipated: { kind: "number", key: "videosParticipated", label: "Number of videos participated in", min: 0, step: 1 },
    competitorNotes: { kind: "text", key: "competitorNotes", label: "Notes on competitors / market observations", placeholder: "Pricing, offers, content ideas…" },
    improvementIdeas: { kind: "text", key: "improvementIdeas", label: "Improvement suggestions", placeholder: "Actionable ideas from the week/day" },
    meetingAttended: { kind: "check", key: "meetingAttended", label: "Weekly marketing meeting attended" },
    videoShoot: { kind: "check", key: "videoShoot", label: "Participated in weekly video shoot" },
    weekendPromos: { kind: "check", key: "weekendPromos", label: "Weekend promos prepared / posts scheduled" },
    stockChecked: { kind: "check", key: "stockChecked", label: "Stock & pricing confirmed (Jumia/Kilimall)" },
    inboxCleared: { kind: "check", key: "inboxCleared", label: "WhatsApp/calls/inquiries cleared" },
    // weeklySummary removed — Saturday now uses a dedicated card
};
exports.dayTaskDefinitions = {
    monday: { title: "Monday", focus: "Product & Stock Management", targetUploads: 50, fields: [shared.stockChecked, shared.inboxCleared, shared.customersServed, shared.competitorNotes, shared.improvementIdeas] },
    tuesday: { title: "Tuesday", focus: "Product Marketing & Engagement", targetUploads: 50, fields: [shared.customersServed, shared.competitorNotes, shared.improvementIdeas] },
    wednesday: { title: "Wednesday", focus: "Live Session & Sales Day", targetUploads: 50, fields: [shared.customersServed] },
    thursday: { title: "Thursday", focus: "Weekly Marketing & Video Shoot", targetUploads: 50, fields: [shared.meetingAttended, shared.videoShoot, shared.officeClean, shared.customersServed] },
    friday: { title: "Friday", focus: "Promotion & Sales Push", targetUploads: 50, fields: [shared.customersServed, shared.officeClean, shared.improvementIdeas] },
    saturday: { title: "Saturday", focus: "Customer Service & Summary", targetUploads: 50, fields: [shared.customersServed, shared.liveSessions, shared.officeClean] },
};
const defaultDayState = (day) => Object.fromEntries(exports.dayTaskDefinitions[day].fields.map((f) => [f.key, f.kind === "number" ? 0 : f.kind === "check" ? false : ""]));
function computeAdminSummary(dayState, market) {
    const num = (k) => (typeof dayState[k] === "number" ? dayState[k] : 0);
    const yes = (k) => (typeof dayState[k] === "boolean" && dayState[k] ? 1 : 0);
    // mk_sales: count rows with non-empty name and a non-empty price
    const mk_sales = (market.sales || []).filter((r) => r.name && r.price !== "").length;
    // totalSalesKES: sum numeric prices; coerce strings and clamp negative to 0
    const totalSalesKES = (market.sales || []).reduce((acc, r) => {
        const p = Number(r.price || 0);
        const valid = Number.isFinite(p) ? Math.max(0, p) : 0;
        return acc + valid;
    }, 0);
    return {
        videos: num("promoVideosPosted") + num("demoVideosRecorded"),
        lives: num("liveSessions") + num("liveSessionsTotal") + num("liveSessionsCount"),
        // prefer new live-session generated leads (legacy fallback removed)
        leads: num("liveSessionsLeadsGenerated"),
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
const marketplaceShopsTyped = [
    "Betech Store",
    "JM Collection",
    "Hitech Power",
    "Maxton",
    "Sky Store",
    "Betech Solar",
    "Kilimall",
];
const defaultShopReview = () => ({ stockChecked: false, pricingConfirmed: false, competitorsReviewed: false, oosReviewed: false, notes: "" });
function MarketplaceStockPricingCard({ value, onChange }) {
    const v = (value || {});
    const [selected, setSelected] = (0, react_1.useState)(marketplaceShopsTyped[0]);
    const ensureFull = () => marketplaceShopsTyped.reduce((acc, s) => ({ ...acc, [s]: { ...(v[s] || defaultShopReview()) } }), {});
    const updateShop = (shop, patch) => {
        const full = ensureFull();
        const next = { ...full, [shop]: { ...(full[shop] || defaultShopReview()), ...patch } };
        onChange(next);
    };
    const current = v[selected] ?? defaultShopReview();
    const tabClass = (active) => `px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${active ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-gray-200'}`;
    const badgeClass = (_active) => `inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-slate-800 text-gray-100`;
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-5", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-slate-100", children: "Marketplace stock & pricing review" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs text-slate-400", children: "Confirm stock, pricing, competitors & out-of-stock per shop." }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "mt-2 overflow-x-auto -mx-2 px-2 snap-x snap-mandatory", role: "tablist", "aria-label": "Marketplace shops", style: { scrollSnapType: 'x mandatory' }, children: (0, jsx_runtime_1.jsx)("div", { className: "flex gap-2 whitespace-nowrap", style: { padding: 6 }, children: marketplaceShopsTyped.map((shop) => {
                                const active = selected === shop;
                                return ((0, jsx_runtime_1.jsx)("button", { type: "button", role: "tab", "aria-selected": active, "aria-label": `Select shop ${shop}`, "aria-controls": `shop-panel-${shop.replace(/\s+/g, '-')}`, onClick: () => setSelected(shop), className: `${tabClass(active)} snap-start min-w-[160px] px-5 py-3`, style: { scrollSnapAlign: 'start' }, children: shop }, shop));
                            }) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-3 items-center", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: badgeClass(Boolean(current.stockChecked)), onClick: () => updateShop(selected, { stockChecked: !Boolean(current.stockChecked) }), children: "Stock" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-100", children: "Stock checked" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-3 items-center mt-3", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: badgeClass(Boolean(current.pricingConfirmed)), onClick: () => updateShop(selected, { pricingConfirmed: !Boolean(current.pricingConfirmed) }), children: "Price" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-100", children: "Pricing confirmed" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-3 items-center mt-3", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: badgeClass(Boolean(current.competitorsReviewed)), onClick: () => updateShop(selected, { competitorsReviewed: !Boolean(current.competitorsReviewed) }), children: "Comp" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-100", children: "Competitors reviewed" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-3 items-center mt-3", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: badgeClass(Boolean(current.oosReviewed)), onClick: () => updateShop(selected, { oosReviewed: !Boolean(current.oosReviewed) }), children: "OOS" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-100", children: "OOS review" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-[11px] font-medium text-slate-400", children: ["Notes (for ", selected, ")"] }), (0, jsx_runtime_1.jsx)("textarea", { rows: 3, className: "w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none", placeholder: "Key issues or actions for this shop\u2026", value: String(current.notes ?? ''), onChange: (e) => updateShop(selected, { notes: e.target.value }) })] })] })] })] }));
}
function CustomerCommsActivityCard({ value, onChange }) {
    if (!value)
        value = {};
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-sm uppercase tracking-wide text-slate-400", children: "Customer & Communications Activity" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: "Track walk-ins, messages and cleared inboxes" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid md:grid-cols-2 gap-3 mt-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs font-medium text-slate-400 mb-1 block", children: "Walk-in served" }), (0, jsx_runtime_1.jsx)(Input_1.default, { "aria-label": "Walk-in served", type: "number", value: String(value.walkInServed ?? 0), onChange: (e) => onChange({ ...value, walkInServed: Number(e.target.value || 0) }) }), (0, jsx_runtime_1.jsx)("label", { className: "text-xs font-medium text-slate-400 mb-1 block", children: "Walk-ins who purchased" }), (0, jsx_runtime_1.jsx)(Input_1.default, { "aria-label": "Walk-ins who purchased", type: "number", value: String(value.walkInsWhoPurchased ?? 0), onChange: (e) => onChange({ ...value, walkInsWhoPurchased: Number(e.target.value || 0) }) }), (0, jsx_runtime_1.jsx)("label", { className: "text-xs font-medium text-slate-400 mb-1 block", children: "Calls handled" }), (0, jsx_runtime_1.jsx)(Input_1.default, { "aria-label": "Calls handled", type: "number", value: String(value.callsHandled ?? 0), onChange: (e) => onChange({ ...value, callsHandled: Number(e.target.value || 0) }) }), (0, jsx_runtime_1.jsx)("label", { className: "text-xs font-medium text-slate-400 mb-1 block", children: "WhatsApp/SMS replied" }), (0, jsx_runtime_1.jsx)(Input_1.default, { "aria-label": "WhatsApp SMS replied", type: "number", value: String(value.whatsappSmsReplied ?? 0), onChange: (e) => onChange({ ...value, whatsappSmsReplied: Number(e.target.value || 0) }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-xs font-medium text-slate-400 mb-1 flex items-center gap-2 py-2", children: [(0, jsx_runtime_1.jsx)("input", { "aria-label": "FB comments replied", type: "checkbox", className: "w-5 h-5", checked: Boolean(value.fbCommentsReplied), onChange: (e) => onChange({ ...value, fbCommentsReplied: e.target.checked }) }), " ", (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-100", children: "FB comments replied" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs font-medium text-slate-400 mb-1 flex items-center gap-2 py-2", children: [(0, jsx_runtime_1.jsx)("input", { "aria-label": "FB DMs replied", type: "checkbox", className: "w-5 h-5", checked: Boolean(value.fbDmsReplied), onChange: (e) => onChange({ ...value, fbDmsReplied: e.target.checked }) }), " ", (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-100", children: "FB DMs replied" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs font-medium text-slate-400 mb-1 flex items-center gap-2 py-2", children: [(0, jsx_runtime_1.jsx)("input", { "aria-label": "IG comments replied", type: "checkbox", className: "w-5 h-5", checked: Boolean(value.igCommentsReplied), onChange: (e) => onChange({ ...value, igCommentsReplied: e.target.checked }) }), " ", (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-100", children: "IG comments replied" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs font-medium text-slate-400 mb-1 flex items-center gap-2 py-2", children: [(0, jsx_runtime_1.jsx)("input", { "aria-label": "IG DMs replied", type: "checkbox", className: "w-5 h-5", checked: Boolean(value.igDmsReplied), onChange: (e) => onChange({ ...value, igDmsReplied: e.target.checked }) }), " ", (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-100", children: "IG DMs replied" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(Checkbox_1.default, { checked: Boolean(value.fbAllCleared), onCheckedChange: (v) => onChange({ ...value, fbAllCleared: Boolean(v) }) }), " ", (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "Facebook inbox cleared" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(Checkbox_1.default, { checked: Boolean(value.igAllCleared), onCheckedChange: (v) => onChange({ ...value, igAllCleared: Boolean(v) }) }), " ", (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "Instagram inbox cleared" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs font-medium text-slate-400 mb-1 block", children: "Competitor notes" }), (0, jsx_runtime_1.jsx)(Textarea_1.default, { rows: 3, value: String(value.competitorNotes ?? ""), onChange: (e) => onChange({ ...value, competitorNotes: e.target.value }) }), (0, jsx_runtime_1.jsx)("label", { className: "text-xs font-medium text-slate-400 mb-1 block", children: "Improvement suggestions" }), (0, jsx_runtime_1.jsx)(Textarea_1.default, { rows: 3, value: String(value.improvementSuggestions ?? ""), onChange: (e) => onChange({ ...value, improvementSuggestions: e.target.value }) })] })] })] })] }));
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
function ProductMarketingVideosCard({ value, onChange }) {
    const v = value || {};
    const setField = (key, val) => onChange({ ...v, [key]: val });
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-5", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-slate-100", children: "Product Marketing Output (Videos)" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs text-slate-400", children: "Track promotional videos posted + demo videos recorded." }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 grid grid-cols-2 gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs font-medium text-slate-400 mb-1 block", children: "Promotional/product videos posted" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", value: String(v.promoVideosPosted ?? 0), onChange: (e) => setField("promoVideosPosted", Number(e.target.value || 0)) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs font-medium text-slate-400 mb-1 block", children: "Product demo videos recorded" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", value: String(v.demoVideosRecorded ?? 0), onChange: (e) => setField("demoVideosRecorded", Number(e.target.value || 0)) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400 mb-2", children: "Platforms posted to:" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", "aria-pressed": Boolean(v.platforms?.facebook), onClick: () => setField("platforms", { ...(v.platforms || {}), facebook: !Boolean(v.platforms?.facebook) }), className: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${v.platforms?.facebook ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-200"}`, children: "Facebook" }), (0, jsx_runtime_1.jsx)("button", { type: "button", "aria-pressed": Boolean(v.platforms?.instagram), onClick: () => setField("platforms", { ...(v.platforms || {}), instagram: !Boolean(v.platforms?.instagram) }), className: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${v.platforms?.instagram ? "bg-pink-600 text-white" : "bg-gray-700 text-gray-200"}`, children: "Instagram" }), (0, jsx_runtime_1.jsx)("button", { type: "button", "aria-pressed": Boolean(v.platforms?.tiktok), onClick: () => setField("platforms", { ...(v.platforms || {}), tiktok: !Boolean(v.platforms?.tiktok) }), className: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${v.platforms?.tiktok ? "bg-black text-white" : "bg-gray-700 text-gray-200"}`, children: "TikTok" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs font-medium text-slate-400 mb-1 block", children: "Video links / titles (optional)" }), (0, jsx_runtime_1.jsx)(Textarea_1.default, { rows: 3, value: String(v.videoLinks ?? ""), onChange: (e) => setField("videoLinks", e.target.value), placeholder: "Paste links or titles for quick reference\u2026" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs font-medium text-slate-400 mb-1 block", children: "Notes / Content ideas" }), (0, jsx_runtime_1.jsx)(Textarea_1.default, { rows: 3, value: String(v.videoNotes ?? ""), onChange: (e) => setField("videoNotes", e.target.value), placeholder: "Ideas, issues, or content plan\u2026" })] })] }));
}
function WednesdayLiveCard({ value, onChange }) {
    const v = value || {};
    const update = (patch) => onChange({ ...v, ...patch });
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-5", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-slate-100", children: "Wednesday \u2013 Live sessions & content output" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Track live sessions with duration, platform and leads generated." }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-slate-400", children: "Live sessions hosted (count)" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, value: String(v.count ?? 0), onChange: (e) => update({ count: Number(e.target.value || 0) }) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-slate-400", children: "Session duration (minutes)" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, value: String(v.durationMinutes ?? 0), onChange: (e) => update({ durationMinutes: Number(e.target.value || 0) }) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-slate-400", children: "Platform" }), (0, jsx_runtime_1.jsxs)("select", { value: v.platform || "Facebook", onChange: (e) => update({ platform: e.target.value }), className: "mt-1 rounded-lg border border-slate-700 bg-black/30 p-2 text-sm text-slate-100 w-full", children: [(0, jsx_runtime_1.jsx)("option", { children: "Facebook" }), (0, jsx_runtime_1.jsx)("option", { children: "Instagram" }), (0, jsx_runtime_1.jsx)("option", { children: "TikTok" }), (0, jsx_runtime_1.jsx)("option", { children: "Other" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-slate-400", children: "Estimated viewers" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, value: String(v.estimatedViewers ?? 0), onChange: (e) => update({ estimatedViewers: Number(e.target.value || 0) }) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-slate-400", children: "Leads generated from live" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, value: String(v.leadsGenerated ?? 0), onChange: (e) => update({ leadsGenerated: Number(e.target.value || 0) }) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-slate-400", children: "Promotional / product clips posted" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, value: String(v.promoClipsPosted ?? 0), onChange: (e) => update({ promoClipsPosted: Number(e.target.value || 0) }) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-slate-400", children: "Top-performing content / issues / ideas" }), (0, jsx_runtime_1.jsx)(Textarea_1.default, { rows: 3, placeholder: "Best clips, questions asked, or improvements for next live\u2026", value: String(v.notes ?? ""), onChange: (e) => update({ notes: e.target.value }) })] })] })] }));
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
function ThursdayWeeklyCard({ value, onChange }) {
    const v = value || {};
    const setField = (k, val) => onChange({ ...v, [k]: val });
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-5", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-slate-100", children: "Thursday \u2013 Weekly Marketing & Office Ops" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs text-slate-400", children: "Track meeting attendance, video shoot, content posted, and workspace organization." }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 space-y-3", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(Checkbox_1.default, { checked: Boolean(v.meetingAttended), onCheckedChange: (val) => setField('meetingAttended', Boolean(val)) }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-100", children: "Weekly marketing meeting attended" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(Checkbox_1.default, { checked: Boolean(v.videoShoot), onCheckedChange: (val) => setField('videoShoot', Boolean(val)) }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-100", children: "Participated in weekly video shoot" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-400 block mb-1", children: "Number of videos participated in" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, value: String(v.videosParticipated ?? 0), onChange: (e) => setField('videosParticipated', Number(e.target.value || 0)) })] }), (0, jsx_runtime_1.jsx)("div", {}), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(Checkbox_1.default, { checked: Boolean(v.officeClean), onCheckedChange: (val) => setField('officeClean', Boolean(val)) }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-100", children: "Office / Display / Photo area cleaned & organized" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-400 block mb-1", children: "Notes (challenges, highlights, ideas)" }), (0, jsx_runtime_1.jsx)(Textarea_1.default, { rows: 3, placeholder: "Notes (challenges, highlights, ideas)", value: String(v.thursdayNotes ?? ''), onChange: (e) => setField('thursdayNotes', e.target.value) })] })] })] }));
}
function FridayWeekendPrepCard({ value, onChange }) {
    const v = value || {};
    const update = (patch) => onChange({ ...v, ...patch });
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-5", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-slate-100", children: "Friday \u2013 Weekend Content & Store Prep" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs text-slate-400", children: "Track videos posted, weekend promos, and workspace readiness." }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-slate-400", children: "Promotional / product videos posted" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, value: String(v.promoVideosPosted ?? 0), onChange: (e) => update({ promoVideosPosted: Number(e.target.value || 0) }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-slate-400", children: "Weekend promos prepared / posts scheduled" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, value: String(v.weekendPromosScheduled ?? 0), onChange: (e) => update({ weekendPromosScheduled: Number(e.target.value || 0) }) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(Checkbox_1.default, { checked: Boolean(v.officeCleanOrganized), onCheckedChange: (val) => update({ officeCleanOrganized: Boolean(val) }) }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-100", children: "Office / display / photo area cleaned & organized" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-slate-400", children: "Notes (weekend plan, issues, ideas)" }), (0, jsx_runtime_1.jsx)(Textarea_1.default, { rows: 3, placeholder: "Key promos, reminders for Saturday/Monday\u2026", value: String(v.notes ?? ''), onChange: (e) => update({ notes: e.target.value }) })] })] })] }));
}
function SaturdayLiveAndStoreCard({ value, onChange }) {
    const v = value || {};
    const update = (patch) => onChange({ ...v, ...patch });
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-5", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-slate-100", children: "Saturday \u2013 Live Sessions & Store Readiness" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs text-slate-400", children: "Track live sessions and ensure the store is ready for the weekend." }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-slate-400", children: "Live sessions hosted (count)" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, value: String(v.count ?? 0), onChange: (e) => update({ count: Number(e.target.value || 0) }) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-slate-400", children: "Session duration (minutes)" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, value: String(v.durationMinutes ?? 0), onChange: (e) => update({ durationMinutes: Number(e.target.value || 0) }) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-slate-400", children: "Platform" }), (0, jsx_runtime_1.jsxs)("select", { value: v.platform || "Facebook", onChange: (e) => update({ platform: e.target.value }), className: "mt-1 rounded-lg border border-slate-700 bg-black/30 p-2 text-sm text-slate-100 w-full", children: [(0, jsx_runtime_1.jsx)("option", { children: "Facebook" }), (0, jsx_runtime_1.jsx)("option", { children: "Instagram" }), (0, jsx_runtime_1.jsx)("option", { children: "TikTok" }), (0, jsx_runtime_1.jsx)("option", { children: "Other" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-slate-400", children: "Estimated viewers" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, value: String(v.estimatedViewers ?? 0), onChange: (e) => update({ estimatedViewers: Number(e.target.value || 0) }) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-slate-400", children: "Leads generated from live" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, value: String(v.leadsGenerated ?? 0), onChange: (e) => update({ leadsGenerated: Number(e.target.value || 0) }) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(Checkbox_1.default, { checked: Boolean(v.officeCleanOrganized), onCheckedChange: (val) => update({ officeCleanOrganized: Boolean(val) }) }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-100", children: "Office / display / photo area cleaned & organized" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-slate-400", children: "Notes (highlights, issues, ideas)" }), (0, jsx_runtime_1.jsx)(Textarea_1.default, { rows: 3, placeholder: "Anything notable from today's live or store setup\u2026", value: String(v.notes ?? ''), onChange: (e) => update({ notes: e.target.value }) })] })] })] }));
}
function DailyTasksUI() {
    const [day, setDay] = (0, react_1.useState)("monday");
    const [dayState, setDayState] = (0, react_1.useState)({
        monday: defaultDayState("monday"),
        tuesday: defaultDayState("tuesday"),
        wednesday: defaultDayState("wednesday"),
        thursday: defaultDayState("thursday"),
        friday: defaultDayState("friday"),
        saturday: defaultDayState("saturday"),
    });
    const [market, setMarket] = (0, react_1.useState)({
        monday: defaultMarketplaceState(),
        tuesday: defaultMarketplaceState(),
        wednesday: defaultMarketplaceState(),
        thursday: defaultMarketplaceState(),
        friday: defaultMarketplaceState(),
        saturday: defaultMarketplaceState(),
    });
    const defaultCustomerComms = () => ({
        walkInServed: 0,
        walkInsWhoPurchased: 0,
        callsHandled: 0,
        whatsappSmsReplied: 0,
        fbCommentsReplied: false,
        fbDmsReplied: false,
        igCommentsReplied: false,
        igDmsReplied: false,
        fbAllCleared: false,
        igAllCleared: false,
        competitorNotes: "",
        improvementSuggestions: "",
    });
    const [customerComms, setCustomerComms] = (0, react_1.useState)({
        monday: defaultCustomerComms(),
        tuesday: defaultCustomerComms(),
        wednesday: defaultCustomerComms(),
        thursday: defaultCustomerComms(),
        friday: defaultCustomerComms(),
        saturday: defaultCustomerComms(),
    });
    const def = exports.dayTaskDefinitions[day];
    const adminSummary = (0, react_1.useMemo)(() => computeAdminSummary(dayState[day], market[day]), [day, dayState, market]);
    const productsCountCurrent = (Number(market[day].newUploaded || 0) + Number(market[day].copiesUploaded || 0) + Number(market[day].productsEdited || 0));
    const totalSalesCurrent = (market[day].sales || []).reduce((acc, s) => acc + (Number(s.price) || 0), 0);
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [success, setSuccess] = (0, react_1.useState)(null);
    const [error, setError] = (0, react_1.useState)(null);
    const [savedAt, setSavedAt] = (0, react_1.useState)(null);
    const [submitter, setSubmitter] = (0, react_1.useState)(() => {
        try {
            return typeof window !== "undefined" ? (localStorage.getItem("betech_submitter") || "") : "";
        }
        catch {
            return "";
        }
    });
    // Try to derive submitter from next-auth session when available
    const _sess = (0, react_2.useSession)();
    const session = _sess?.data;
    (0, react_1.useEffect)(() => {
        if (!session)
            return;
        const name = session?.user?.name ?? session?.user?.email ?? "";
        if (name && name !== submitter) {
            setSubmitter(name);
            try {
                localStorage.setItem("betech_submitter", name);
            }
            catch { }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session]);
    // Derive the overall `stockChecked` flag for the day from per-shop review.
    // The derived flag is true only when every configured shop has both
    // `stockChecked` AND `pricingConfirmed` set to true. This keeps backward
    // compatibility with the older `stockChecked` day field used by exports.
    (0, react_1.useEffect)(() => {
        try {
            const review = market[day].review;
            let derived = false;
            if (review) {
                derived = marketplaceShopsTyped.every((s) => Boolean(review[s]?.stockChecked) && Boolean(review[s]?.pricingConfirmed));
            }
            setDayState((prev) => {
                if (prev[day] && prev[day]["stockChecked"] === derived)
                    return prev;
                return { ...prev, [day]: { ...prev[day], stockChecked: derived } };
            });
        }
        catch (e) {
            // defensive: don't crash the UI
        }
        // only watch market[day] and day
    }, [market, day]);
    const autosaveTimer = (0, react_1.useRef)(null);
    const lastAutoSaved = (0, react_1.useRef)(null);
    const isAutoSaving = (0, react_1.useRef)(false);
    const pendingAutosave = (0, react_1.useRef)(false);
    const autosaveRetryTimer = (0, react_1.useRef)(null);
    const autosaveRetryCount = (0, react_1.useRef)(0);
    const [autosaveStatus, setAutosaveStatus] = (0, react_1.useState)(null);
    const [salesErrors, setSalesErrors] = (0, react_1.useState)({});
    const validatePayload = (body) => {
        if (!body.day)
            return "day is required";
        if (body.productsCount < 0)
            return "productsCount must be >= 0";
        if (body.totalSales < 0)
            return "totalSales must be >= 0";
        if (!Array.isArray(body.tasks.sales))
            return "sales must be an array";
        if (body.tasks.marketplaceReview && typeof body.tasks.marketplaceReview !== "object")
            return "marketplaceReview must be object";
        if (body.tasks.customerComms && typeof body.tasks.customerComms !== "object")
            return "customerComms must be object";
        if (body.submittedBy && typeof body.submittedBy !== "string")
            return "submittedBy must be a string";
        for (const s of body.tasks.sales) {
            if (typeof s.productName !== "string")
                return "each sale must have a productName";
            if (Number(s.price) < 0)
                return "sale price must be >= 0";
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
            const newSalesErrors = {};
            for (const s of rawSales) {
                const hasName = s.productName !== "";
                const hasPrice = Number(s.price) > 0;
                if (hasName && !hasPrice)
                    newSalesErrors[s.id] = "Enter a valid price (> 0) or remove row";
                else if (!hasName && hasPrice)
                    newSalesErrors[s.id] = "Enter product name or clear price";
                else
                    newSalesErrors[s.id] = null;
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
            }
            else {
                setSuccess("Saved successfully");
                // optionally clear the day's inputs
                // setDayState((s) => ({ ...s, [day]: defaultDayState(day) }));
                // setMarket((m) => ({ ...m, [day]: defaultMarketplaceState() }));
                // auto-dismiss success after a short time
                setTimeout(() => setSuccess(null), 5000);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setBusy(false);
        }
    };
    const handleRetry = () => {
        // simple retry invokes handleSave again
        handleSave();
    };
    // Auto-save: debounce when dayState or market changes
    (0, react_1.useEffect)(() => {
        const snapshot = JSON.stringify({ day, dayState: dayState[day], market: market[day] });
        if (lastAutoSaved.current === snapshot)
            return;
        if (autosaveTimer.current)
            window.clearTimeout(autosaveTimer.current);
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
                    if (!res.ok)
                        throw new Error(`Autosave failed ${res.status}`);
                    lastAutoSaved.current = snapshot;
                    const now = new Date();
                    setSavedAt(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
                    setAutosaveStatus("saved");
                    autosaveRetryCount.current = 0;
                    if (pendingAutosave.current) {
                        pendingAutosave.current = false;
                        // Immediately trigger another autosave cycle
                        if (autosaveTimer.current)
                            window.clearTimeout(autosaveTimer.current);
                        autosaveTimer.current = window.setTimeout(() => { }, 50);
                    }
                }
                catch (err) {
                    if (autosaveRetryCount.current < backoffs.length) {
                        autosaveRetryCount.current += 1;
                        setAutosaveStatus("Autosave failed — retrying...");
                        const wait = backoffs[autosaveRetryCount.current - 1];
                        if (autosaveRetryTimer.current)
                            window.clearTimeout(autosaveRetryTimer.current);
                        autosaveRetryTimer.current = window.setTimeout(() => {
                            void doAutosave();
                        }, wait);
                    }
                    else {
                        setAutosaveStatus("Autosave paused");
                    }
                }
                finally {
                    isAutoSaving.current = false;
                }
            };
            void doAutosave();
        }, 700);
        return () => {
            if (autosaveTimer.current)
                window.clearTimeout(autosaveTimer.current);
            if (autosaveRetryTimer.current)
                window.clearTimeout(autosaveRetryTimer.current);
            autosaveRetryCount.current = 0;
            pendingAutosave.current = false;
            isAutoSaving.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dayState, market, day]);
    return ((0, jsx_runtime_1.jsx)("div", { className: "min-h-screen bg-slate-950 text-slate-100", children: (0, jsx_runtime_1.jsxs)("main", { className: "mx-auto max-w-6xl p-6 space-y-6", children: [success ? ((0, jsx_runtime_1.jsx)("div", { className: "p-3 rounded bg-emerald-900/10 text-emerald-300", children: success })) : null, error ? ((0, jsx_runtime_1.jsxs)("div", { className: "p-3 rounded bg-rose-900/10 text-rose-300 flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { children: error }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-2", children: (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", onClick: handleRetry, children: "Retry" }) })] })) : null, (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold", children: "Daily Task Ops (Mon\u2013Sat)" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Every task you complete brings you closer to your next reward." })] }), (0, jsx_runtime_1.jsx)("div", {})] }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-6 gap-2 w-full", children: Object.keys(exports.dayTaskDefinitions).map((k) => {
                        const isActive = day === k;
                        const activeCls = "rounded-xl inline-flex items-center justify-center gap-2 text-xs border border-white/10 text-slate-200 bg-white/5 px-3 py-2";
                        const inactiveCls = "rounded-xl inline-flex items-center justify-center gap-2 text-xs border border-white/10 text-slate-300 bg-transparent hover:bg-white/5 px-3 py-2";
                        return ((0, jsx_runtime_1.jsx)(Button_1.default, { onClick: () => setDay(k), variant: isActive ? "secondary" : "secondary", className: isActive ? activeCls : inactiveCls, children: exports.dayTaskDefinitions[k].title.slice(0, 3) }, k));
                    }) }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-6", children: (0, jsx_runtime_1.jsxs)(Card_1.default, { className: cardClasses, children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold", children: def.title }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm opacity-70", children: ["Focus: ", def.focus] })] }), def.targetUploads ? ((0, jsx_runtime_1.jsxs)("div", { className: "text-xs", children: [(0, jsx_runtime_1.jsxs)("div", { children: ["Target uploads: ", def.targetUploads, "/day"] }), (0, jsx_runtime_1.jsx)("div", { className: "w-40 mt-1 bg-white/5 rounded-full h-2 overflow-hidden", children: (() => {
                                                    const { uploadsToday } = (0, utils_1.computeUploadProgress)(market[day], def.targetUploads || 1);
                                                    return (0, jsx_runtime_1.jsx)(ProgressBar_1.default, { value: uploadsToday, max: def.targetUploads || 1, label: `Target uploads (${def.targetUploads}/day)` });
                                                })() })] })) : null] }), (0, jsx_runtime_1.jsxs)(Card_1.default, { className: cardClasses + " mt-4 space-y-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-semibold text-sm text-slate-400", children: "Jumia / Kilimall Operations" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid md:grid-cols-3 gap-3", children: [(0, jsx_runtime_1.jsx)(LabeledNumber, { label: "New products uploaded", value: market[day].newUploaded, onChange: (v) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], newUploaded: v } })) }), (0, jsx_runtime_1.jsx)(LabeledNumber, { label: "Copies of products uploaded", value: market[day].copiesUploaded, onChange: (v) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], copiesUploaded: v } })) }), (0, jsx_runtime_1.jsx)(LabeledNumber, { label: "Products edited", value: market[day].productsEdited, onChange: (v) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], productsEdited: v } })) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2 mt-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm font-medium", children: "Sales Records" }), market[day].sales.map((row) => ((0, jsx_runtime_1.jsxs)("div", { className: cardClasses + " mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-sm font-semibold", children: "Receipt" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: "Totals are calculated automatically." })] }), (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", onClick: () => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.filter((r) => r.id !== row.id) } })), children: "Remove receipt" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-12 gap-4 mt-4 items-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "col-span-4", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs font-medium text-slate-400 mb-1 block", children: "Selling total (KES)" }), (0, jsx_runtime_1.jsx)(Input_1.default, { value: row.price === "" ? "" : String(row.price), type: "number", onChange: (e) => {
                                                                            const raw = e.target.value;
                                                                            const parsed = raw === "" ? 0 : Number(raw);
                                                                            const safe = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
                                                                            setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => (r.id === row.id ? { ...r, price: safe } : r)) } }));
                                                                        } })] }), (0, jsx_runtime_1.jsxs)("div", { className: "col-span-5", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs font-medium text-slate-400 mb-1 block", children: "Receipt number" }), (0, jsx_runtime_1.jsx)(Input_1.default, { value: row.receiptNumber || '', onChange: (e) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => r.id === row.id ? { ...r, receiptNumber: e.target.value } : r) } })), placeholder: "Required" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "col-span-3", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs font-medium text-slate-400 mb-1 block", children: "Payment method" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 mt-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: `px-3 py-1 rounded-full text-xs ${row.paymentMethod === 'MPESA' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-gray-200'}`, onClick: () => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => r.id === row.id ? { ...r, paymentMethod: 'MPESA' } : r) } })), children: "MPESA" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: `px-3 py-1 rounded-full text-xs ${row.paymentMethod === 'CASH' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-gray-200'}`, onClick: () => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => r.id === row.id ? { ...r, paymentMethod: 'CASH' } : r) } })), children: "Cash" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm font-medium", children: "Products in this receipt" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 grid grid-cols-12 gap-2 items-start", children: [(0, jsx_runtime_1.jsxs)("div", { className: "col-span-8", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs font-medium text-slate-400 mb-1 block", children: "Product name" }), (0, jsx_runtime_1.jsx)(Input_1.default, { placeholder: "Product name", value: row.name || '', onChange: (e) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => r.id === row.id ? { ...r, name: e.target.value } : r) } })) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "col-span-3", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs font-medium text-slate-400 mb-1 block", children: "Buying price (KES)" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", value: String(row.buyingPrice ?? ''), onChange: (e) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => r.id === row.id ? { ...r, buyingPrice: Number(e.target.value || 0) } : r) } })) })] }), (0, jsx_runtime_1.jsx)("div", { className: "col-span-1 flex items-center", children: (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "danger", onClick: () => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.filter((r) => r.id !== row.id) } })), children: "Remove" }) })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-3", children: (0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl border border-white/10 text-slate-200 bg-transparent hover:bg-white/5 text-sm px-3 py-2 inline-flex items-center justify-center gap-2", onClick: () => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: [...prev[day].sales, { id: crypto.randomUUID(), name: '', price: '', paymentMethod: 'MPESA', receiptNumber: '' }] } })), children: "+ Add product to this receipt" }) })] })] }, row.id))), (0, jsx_runtime_1.jsx)("div", { className: "flex justify-end", style: { zIndex: 2 }, children: (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "primary", className: "rounded-xl px-4 py-2 bg-emerald-500 text-black font-semibold hover:brightness-95 inline-flex items-center justify-center gap-2 text-sm", "aria-label": "Add sales row", onClick: () => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: [...prev[day].sales, { id: crypto.randomUUID(), name: "", price: "" }] } })), children: "Add row" }) })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "grid md:grid-cols-2 gap-4 mt-4", children: (() => {
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
                                    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { className: "w-full", children: (0, jsx_runtime_1.jsx)(CustomerCommsActivityCard, { value: customerComms[day], onChange: (next) => setCustomerComms((prev) => ({ ...prev, [day]: next })) }) }), day === "tuesday" && ((0, jsx_runtime_1.jsx)("div", { className: "w-full", children: (0, jsx_runtime_1.jsx)(ProductMarketingVideosCard, { value: dayState[day], onChange: (next) => setDayState((prev) => {
                                                        const platforms = next.platforms || {};
                                                        const flattened = {
                                                            platforms_facebook: Boolean(platforms.facebook),
                                                            platforms_instagram: Boolean(platforms.instagram),
                                                            platforms_tiktok: Boolean(platforms.tiktok),
                                                        };
                                                        const rest = { ...next };
                                                        delete rest.platforms;
                                                        // prefer new keys `promoVideosPosted` and `demoVideosRecorded`
                                                        return { ...prev, [day]: { ...prev[day], ...rest, ...flattened } };
                                                    }) }) })), day === "wednesday" && ((0, jsx_runtime_1.jsx)("div", { className: "w-full", children: (0, jsx_runtime_1.jsx)(WednesdayLiveCard, { value: dayState[day], onChange: (next) => setDayState((prev) => {
                                                        const rest = { ...next };
                                                        // normalize live session details into primitive keys
                                                        const mapped = {
                                                            liveSessionsCount: Number(rest.count || 0),
                                                            liveSessionsDurationMinutes: Number(rest.durationMinutes || 0),
                                                            liveSessionsPlatform: String(rest.platform || ""),
                                                            liveSessionsEstimatedViewers: Number(rest.estimatedViewers || 0),
                                                            liveSessionsLeadsGenerated: Number(rest.leadsGenerated || 0),
                                                            promoClipsPosted: Number(rest.promoClipsPosted || 0),
                                                            liveNotes: String(rest.notes || ""),
                                                        };
                                                        // remove nested keys we mapped
                                                        delete rest.count;
                                                        delete rest.durationMinutes;
                                                        delete rest.platform;
                                                        delete rest.estimatedViewers;
                                                        delete rest.leadsGenerated;
                                                        delete rest.promoClipsPosted;
                                                        delete rest.notes;
                                                        return { ...prev, [day]: { ...prev[day], ...rest, ...mapped } };
                                                    }) }) })), day === "thursday" && ((0, jsx_runtime_1.jsx)("div", { className: "w-full", children: (0, jsx_runtime_1.jsx)(ThursdayWeeklyCard, { value: dayState[day], onChange: (next) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], ...next } })) }) })), day === "friday" && ((0, jsx_runtime_1.jsx)("div", { className: "w-full", children: (0, jsx_runtime_1.jsx)(FridayWeekendPrepCard, { value: dayState[day], onChange: (next) => setDayState((prev) => ({
                                                        ...prev,
                                                        [day]: {
                                                            ...prev[day],
                                                            // write new keys produced by the Friday card
                                                            promoVideosPosted: Number(next.promoVideosPosted ?? 0),
                                                            weekendPromosScheduled: Number(next.weekendPromosScheduled ?? 0),
                                                            officeCleanOrganized: Boolean(next.officeCleanOrganized ?? false),
                                                            weekendNotes: String(next.notes ?? ""),
                                                            ...next,
                                                        },
                                                    })) }) })), day === "saturday" && ((0, jsx_runtime_1.jsx)("div", { className: "w-full", children: (0, jsx_runtime_1.jsx)(SaturdayLiveAndStoreCard, { value: dayState[day], onChange: (next) => setDayState((prev) => {
                                                        const rest = { ...next };
                                                        const mapped = {
                                                            liveSessionsCount: Number(rest.count || 0),
                                                            liveSessionsDurationMinutes: Number(rest.durationMinutes || 0),
                                                            liveSessionsPlatform: String(rest.platform || ""),
                                                            liveSessionsEstimatedViewers: Number(rest.estimatedViewers || 0),
                                                            liveSessionsLeadsGenerated: Number(rest.leadsGenerated || 0),
                                                            officeCleanOrganized: Boolean(rest.officeCleanOrganized || false),
                                                            saturdayNotes: String(rest.notes || ""),
                                                        };
                                                        // remove nested keys we mapped
                                                        delete rest.count;
                                                        delete rest.durationMinutes;
                                                        delete rest.platform;
                                                        delete rest.estimatedViewers;
                                                        delete rest.leadsGenerated;
                                                        delete rest.officeCleanOrganized;
                                                        delete rest.notes;
                                                        return { ...prev, [day]: { ...prev[day], ...rest, ...mapped } };
                                                    }) }) })), def.fields.map((f) => {
                                                if (skipKeys.has(f.key))
                                                    return null;
                                                // Replace the single stockChecked checkbox with the per-shop card
                                                if (f.kind === "check" && f.key === "stockChecked") {
                                                    return ((0, jsx_runtime_1.jsx)("div", { className: "w-full", children: (0, jsx_runtime_1.jsx)(MarketplaceStockPricingCard, { value: market[day].review, onChange: (next) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], review: next } })) }) }, f.key));
                                                }
                                                return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-start gap-3 p-3 rounded-2xl border border-gray-700/30", children: [f.kind === "check" && ((0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(Checkbox_1.default, { checked: Boolean(dayState[day][f.key]), onCheckedChange: (v) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], [f.key]: v } })) }), (0, jsx_runtime_1.jsxs)("span", { className: "text-sm flex items-center gap-2", children: [renderIconForKey(f.key), (0, jsx_runtime_1.jsx)("span", { children: f.label })] })] })), f.kind === "number" && ((0, jsx_runtime_1.jsxs)("div", { className: "w-full", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-sm block mb-1 flex items-center gap-2", children: [renderIconForKey(f.key), f.label] }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: f.min, step: f.step, value: String(dayState[day][f.key] || 0), onChange: (e) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], [f.key]: Number(e.target.value) } })) })] })), f.kind === "text" && ((0, jsx_runtime_1.jsxs)("div", { className: "w-full", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-sm block mb-1 flex items-center gap-2", children: [renderIconForKey(f.key), f.label] }), (0, jsx_runtime_1.jsx)(Textarea_1.default, { rows: 3, className: "", placeholder: f.placeholder, value: String(dayState[day][f.key] || ""), onChange: (e) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], [f.key]: e.target.value } })) })] }))] }, f.key));
                                            })] }));
                                })() }), (0, jsx_runtime_1.jsxs)(Card_1.default, { className: cardClasses + " mt-4 flex gap-2 justify-end", children: [(0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", onClick: () => {
                                            setDayState((s) => ({ ...s, [day]: defaultDayState(day) }));
                                            setMarket((m) => ({ ...m, [day]: defaultMarketplaceState() }));
                                        }, children: "Reset day" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("div", { "aria-live": "polite", className: "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200", children: autosaveStatus === "saved" && savedAt ? `Saved at ${savedAt}` : autosaveStatus || "Autosave paused" }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "primary", className: "rounded-xl px-4 py-2 bg-emerald-500 text-black font-semibold hover:brightness-95 inline-flex items-center justify-center gap-2 text-sm", "aria-label": "Submit report", onClick: busy ? undefined : handleSave, children: busy ? "Submitting..." : "Submit report" })] })] })] }) })] }) }));
}
const SummaryItem = ({ label, value }) => ((0, jsx_runtime_1.jsxs)("div", { className: "p-3 rounded-xl border border-gray-700/30 bg-transparent", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-[11px] opacity-70 mb-1", children: label }), (0, jsx_runtime_1.jsx)("div", { className: "font-semibold", children: value })] }));
const LabeledNumber = ({ label, value, onChange }) => ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-400 mb-1 block", children: label }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", value: value === "" ? "" : String(value), onChange: (e) => onChange(e.target.value === "" ? "" : Number(e.target.value)) })] }));
// Uses shared Sparkline component from `_components`
function renderIconForKey(key) {
    switch (key) {
        case "demoRecorded":
        case "demoVideosRecorded":
        case "officeClean":
            return (0, jsx_runtime_1.jsx)(lucide_react_1.CheckSquare, { className: "w-4 h-4 opacity-80" });
        case "commentsDMs":
            return (0, jsx_runtime_1.jsx)(lucide_react_1.MessageSquare, { className: "w-4 h-4 opacity-80" });
        case "customersServed":
            return (0, jsx_runtime_1.jsx)(lucide_react_1.Users, { className: "w-4 h-4 opacity-80" });
        case "improvementIdeas":
        case "weeklySummary":
            return (0, jsx_runtime_1.jsx)(lucide_react_1.Lightbulb, { className: "w-4 h-4 opacity-80" });
        case "competitorNotes":
            return (0, jsx_runtime_1.jsx)(lucide_react_1.ClipboardList, { className: "w-4 h-4 opacity-80" });
        default:
            return null;
    }
}
