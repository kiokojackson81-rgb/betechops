"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DailyReportRedesignDraft;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const cardClasses = "rounded-2xl border border-white/10 bg-[var(--card,#171b23)] border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20";
function formatDay(date) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
}
const defaultMarketplaceState = () => ({
    newUploaded: "",
    copiesUploaded: "",
    productsEdited: "",
    sales: [{ id: crypto.randomUUID(), name: "", price: "", paymentMethod: "MPESA", receiptNumber: "" }],
    review: undefined,
});
const defaultDayState = () => ({
    customersServed: 0,
    commentsDMs: 0,
    liveSessions: 0,
    officeClean: false,
    videosParticipated: 0,
    competitorNotes: "",
    improvementIdeas: "",
    meetingAttended: false,
    videoShoot: false,
    weekendPromos: false,
    stockChecked: false,
    inboxCleared: false,
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
function ReceiptSection({ receipts, setReceipts, salesErrors }) {
    const updateReceipt = (idx, patch) => setReceipts((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    return ((0, jsx_runtime_1.jsxs)("div", { className: cardClasses + " p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Add each receipt for today" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Totals are calculated automatically." }), receipts.map((rec, i) => ((0, jsx_runtime_1.jsxs)("div", { className: "border border-slate-800 rounded-lg p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Selling total (KES)" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100", value: rec.sellingTotal, onChange: (e) => updateReceipt(i, { sellingTotal: parseFloat(e.target.value) || 0 }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Receipt number (required)" }), (0, jsx_runtime_1.jsx)("input", { type: "text", className: "w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100", placeholder: "Required", value: rec.receiptNumber, onChange: (e) => updateReceipt(i, { receiptNumber: e.target.value }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Payment method (required)" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: `px-4 py-1 rounded-full text-xs font-medium border transition-colors ${rec.paymentMethod === "MPESA"
                                                    ? "bg-emerald-500 text-black border-emerald-600"
                                                    : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"}`, onClick: () => updateReceipt(i, { paymentMethod: "MPESA" }), children: "MPESA" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: `px-4 py-1 rounded-full text-xs font-medium border transition-colors ${rec.paymentMethod === "CASH"
                                                    ? "bg-emerald-500 text-black border-emerald-600"
                                                    : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"}`, onClick: () => updateReceipt(i, { paymentMethod: "CASH" }), children: "Cash" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2 mt-4", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Products in this receipt" }), rec.products.map((p, idx) => ((0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-[3fr_1fr_auto] gap-2 items-center", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: p.name, className: "rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100", onChange: (e) => updateReceipt(i, { products: rec.products.map((it, j) => (j === idx ? { ...it, name: e.target.value } : it)) }) }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: p.price, className: "rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100", onChange: (e) => updateReceipt(i, { products: rec.products.map((it, j) => (j === idx ? { ...it, price: parseFloat(e.target.value) || 0 } : it)) }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "text-xs text-red-400 hover:text-red-300", onClick: () => updateReceipt(i, { products: rec.products.filter((_, j) => j !== idx) }), children: "Remove" })] }, idx))), rec.products.map((p) => {
                                const id = `${rec.id}:${p.name}:${p.price}`;
                                const err = salesErrors[id];
                                return err ? ((0, jsx_runtime_1.jsx)("div", { className: "text-xs text-rose-300 mt-1", children: err }, `err-${id}`)) : null;
                            }), (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsx)("button", { type: "button", className: "mt-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200", onClick: () => updateReceipt(i, { products: [...rec.products, { name: "", price: 0 }] }), children: "+ Add product to this receipt" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 flex flex-col gap-1 text-sm text-slate-400", children: [(0, jsx_runtime_1.jsxs)("span", { children: ["Total sales (KES): ", Number(rec.sellingTotal).toLocaleString()] }), (0, jsx_runtime_1.jsxs)("span", { children: ["Total items: ", rec.products.length] })] })] }, rec.id))), (0, jsx_runtime_1.jsx)("div", { className: "flex gap-2", children: (0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200", onClick: () => setReceipts((r) => [...r, { id: crypto.randomUUID(), sellingTotal: 0, receiptNumber: "", paymentMethod: "MPESA", products: [] }]), children: "+ Add receipt" }) })] }));
}
function DayChecklist({ title, items, dayKey, dayState, setDayState }) {
    const keyFor = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    return ((0, jsx_runtime_1.jsxs)("div", { className: cardClasses + " p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: title }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-3", children: items.map((text) => {
                    const k = keyFor(text);
                    const active = Boolean(dayState[dayKey]?.[k]);
                    return ((0, jsx_runtime_1.jsx)("button", { type: "button", className: `rounded-full px-4 py-2 text-sm border transition-all ${active ? "bg-emerald-500 text-black border-emerald-600" : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"}`, onClick: () => setDayState((prev) => ({ ...prev, [dayKey]: { ...prev[dayKey], [k]: !Boolean(prev[dayKey]?.[k]) } })), children: text }, text));
                }) })] }));
}
function DailyReportRedesignDraft() {
    const [selectedDate, setSelectedDate] = (0, react_1.useState)(() => new Date());
    const dayName = formatDay(selectedDate);
    // per-day state to better mirror DailyTasksUI
    const [dayState, setDayState] = (0, react_1.useState)({
        monday: defaultDayState(),
        tuesday: defaultDayState(),
        wednesday: defaultDayState(),
        thursday: defaultDayState(),
        friday: defaultDayState(),
        saturday: defaultDayState(),
    });
    const [market, setMarket] = (0, react_1.useState)({
        monday: defaultMarketplaceState(),
        tuesday: defaultMarketplaceState(),
        wednesday: defaultMarketplaceState(),
        thursday: defaultMarketplaceState(),
        friday: defaultMarketplaceState(),
        saturday: defaultMarketplaceState(),
    });
    const [customerComms, setCustomerComms] = (0, react_1.useState)({
        monday: defaultCustomerComms(),
        tuesday: defaultCustomerComms(),
        wednesday: defaultCustomerComms(),
        thursday: defaultCustomerComms(),
        friday: defaultCustomerComms(),
        saturday: defaultCustomerComms(),
    });
    const [receipts, setReceipts] = (0, react_1.useState)(() => [
        { id: crypto.randomUUID(), sellingTotal: 0, receiptNumber: "", paymentMethod: "MPESA", products: [] },
    ]);
    const [notes, setNotes] = (0, react_1.useState)("");
    // New metrics/state per final instructions
    const [newProducts, setNewProducts] = (0, react_1.useState)(0);
    const [productsEdited, setProductsEdited] = (0, react_1.useState)(0);
    const [copiesUploaded, setCopiesUploaded] = (0, react_1.useState)(0);
    const [walkInServed, setWalkInServed] = (0, react_1.useState)(0);
    const [purchasesMade, setPurchasesMade] = (0, react_1.useState)(0);
    const [liveSessionsCount, setLiveSessionsCount] = (0, react_1.useState)(0);
    const [commissionEarned, setCommissionEarned] = (0, react_1.useState)(0);
    // Tuesday market engagement
    const [promoVideos, setPromoVideos] = (0, react_1.useState)(0);
    const [demoVideos, setDemoVideos] = (0, react_1.useState)(0);
    const [engagementReplies, setEngagementReplies] = (0, react_1.useState)(0);
    const [allCommentsReplied, setAllCommentsReplied] = (0, react_1.useState)(false);
    // Weekly concerns / summary
    const [concernsText, setConcernsText] = (0, react_1.useState)("");
    const [autosaveStatus, setAutosaveStatus] = (0, react_1.useState)(null);
    const [savedAt, setSavedAt] = (0, react_1.useState)(null);
    const autosaveTimer = (0, react_1.useRef)(null);
    const isAutoSaving = (0, react_1.useRef)(false);
    const pendingAutosave = (0, react_1.useRef)(false);
    const autosaveRetryTimer = (0, react_1.useRef)(null);
    const autosaveRetryCount = (0, react_1.useRef)(0);
    const backoffs = [1500, 3000, 6000];
    const dayItems = {
        Monday: [
            { title: "Product & Stock Management", items: ["Uploaded new products", "Uploaded product copies", "Edited products"] },
            { title: "Customer & Communications", items: ["Replied to FB comments", "Replied to FB DMs", "Cleared FB inbox"] },
        ],
        Tuesday: [
            { title: "Product Marketing Output (Videos)", items: ["Recorded promotional videos", "Posted to Facebook", "Posted to Instagram"] },
        ],
        Wednesday: [
            { title: "Live Sessions & Content Output", items: ["Hosted live session", "Produced product clips"] },
        ],
        Thursday: [
            { title: "Weekly Marketing Activities", items: ["Attended weekly meeting", "Uploaded promo videos"] },
        ],
        Friday: [{ title: "Promotional Preparation", items: ["Shot promotional videos", "Scheduled weekend posts"] }],
        Saturday: [{ title: "Live Sessions & Weekend Prep", items: ["Hosted live session", "Organised store"] }],
    };
    const sections = dayItems[dayName] ?? dayItems.Monday;
    const totalSales = (0, react_1.useMemo)(() => receipts.reduce((acc, r) => acc + Number(r.sellingTotal || 0), 0), [receipts]);
    const totalReceipts = receipts.length;
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
    async function doSave() {
        // prevent overlapping autosaves
        if (isAutoSaving.current) {
            pendingAutosave.current = true;
            return;
        }
        isAutoSaving.current = true;
        setAutosaveStatus("saving");
        try {
            const rawSales = receipts.flatMap((r) => {
                const base = { receiptNumber: String(r.receiptNumber || ""), paymentMethod: r.paymentMethod || "MPESA", total: Number(r.sellingTotal || 0) };
                if (Array.isArray(r.products) && r.products.length > 0) {
                    return r.products.map((p) => ({ id: `${r.id}:${p.name}:${p.price}`, ...base, productName: String(p.name || "").trim(), price: Number(p.price || 0) }));
                }
                return [{ id: `${r.id}:receipt`, ...base, productName: "", price: Number(r.sellingTotal || 0) }];
            });
            // Validate sales rows: require that rows are either empty or have productName and price>0
            const newSalesErrors = {};
            for (const s of rawSales) {
                const hasName = String(s.productName || "").trim() !== "";
                const hasPrice = Number(s.price) > 0;
                if (hasName && !hasPrice)
                    newSalesErrors[s.id] = "Enter a valid price (> 0) or remove row";
                else if (!hasName && hasPrice)
                    newSalesErrors[s.id] = "Enter product name or clear price";
                else
                    newSalesErrors[s.id] = null;
            }
            setSalesErrors(newSalesErrors);
            const hasSalesError = Object.values(newSalesErrors).some((v) => v);
            if (hasSalesError) {
                setAutosaveStatus("Autosave paused — fix sales rows");
                isAutoSaving.current = false;
                return;
            }
            const sales = rawSales.map((s) => ({ productName: s.productName, price: Number(s.price || 0), receiptNumber: s.receiptNumber, paymentMethod: s.paymentMethod }));
            const productsCount = receipts.reduce((acc, r) => acc + (Array.isArray(r.products) ? r.products.length : 0), 0);
            const dayKey = dayName.toLowerCase() || "monday";
            const categories = {
                newUploads: Number(market[dayKey].newUploaded) || 0,
                copiesUploaded: Number(market[dayKey].copiesUploaded) || 0,
                productsEdited: Number(market[dayKey].productsEdited) || 0,
            };
            const marketing = {
                attendedMarketingMeeting: Boolean(dayState[dayKey]["meetingAttended"]),
                participatedVideoShoot: Boolean(dayState[dayKey]["videoShoot"]),
                marketingVideosShot: Number(dayState[dayKey]["promoVideosPosted"] || 0) + Number(dayState[dayKey]["demoVideosRecorded"] || 0),
            };
            const customerOperations = {
                walkInCustomers: Number(dayState[dayKey]["customersServed"]) || 0,
                customersPurchased: 0,
                liveViewers: Number(dayState[dayKey]["liveSessions"]) || 0,
                livePurchases: 0,
            };
            const officeMaintenance = {
                officeCleaned: Boolean(dayState[dayKey]["officeClean"]),
                officeNotes: String((dayState[dayKey]["competitorNotes"] || "").toString().trim()),
            };
            const marketplaceReview = market[dayKey].review || undefined;
            const customerCommsForDay = customerComms[dayKey] || undefined;
            const trimmedDayFields = { ...dayState[dayKey], competitorNotes: String((dayState[dayKey]["competitorNotes"] || "")).trim(), improvementIdeas: String((dayState[dayKey]["improvementIdeas"] || "")).trim() };
            const body = {
                date: selectedDate.toISOString(),
                day: dayKey,
                productsCount,
                totalSales,
                submittedBy: null,
                // top-level metrics per final instructions
                newProducts: Number(newProducts) || 0,
                productsEdited: Number(productsEdited) || 0,
                copiesUploaded: Number(copiesUploaded) || 0,
                walkInServed: Number(walkInServed) || 0,
                purchasesMade: Number(purchasesMade) || 0,
                liveSessionsCount: Number(liveSessionsCount) || 0,
                commissionEarned: Number(commissionEarned) || 0,
                marketEngagement: {
                    promoVideos: Number(promoVideos) || 0,
                    demoVideos: Number(demoVideos) || 0,
                    engagementReplies: Number(engagementReplies) || 0,
                    allCommentsReplied: Boolean(allCommentsReplied),
                },
                concerns: String(concernsText || ""),
                tasks: {
                    categories,
                    marketing,
                    customerOperations,
                    officeMaintenance,
                    marketplaceReview,
                    customerComms: customerCommsForDay,
                    sales,
                    dayFields: trimmedDayFields,
                },
            };
            const validationErr = validatePayload(body);
            if (validationErr) {
                setAutosaveStatus(validationErr);
                isAutoSaving.current = false;
                return;
            }
            const res = await fetch("/api/daily-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (!res.ok)
                throw new Error(`Save failed ${res.status}`);
            const now = new Date();
            setSavedAt(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
            setAutosaveStatus("saved");
            autosaveRetryCount.current = 0;
            if (pendingAutosave.current) {
                pendingAutosave.current = false;
                void doSave();
            }
            setTimeout(() => setAutosaveStatus(null), 3000);
        }
        catch (err) {
            // retry logic
            if (autosaveRetryCount.current < backoffs.length) {
                autosaveRetryCount.current += 1;
                setAutosaveStatus("Autosave failed — retrying...");
                const wait = backoffs[autosaveRetryCount.current - 1];
                if (autosaveRetryTimer.current)
                    window.clearTimeout(autosaveRetryTimer.current);
                autosaveRetryTimer.current = window.setTimeout(() => {
                    void doSave();
                }, wait);
            }
            else {
                setAutosaveStatus("Autosave paused");
            }
        }
        finally {
            isAutoSaving.current = false;
        }
    }
    function handleSubmit() {
        void doSave();
    }
    // autosave: debounce changes to receipts/notes
    (0, react_1.useEffect)(() => {
        if (autosaveTimer.current)
            window.clearTimeout(autosaveTimer.current);
        autosaveTimer.current = window.setTimeout(() => {
            void doSave();
        }, 700);
        return () => {
            if (autosaveTimer.current)
                window.clearTimeout(autosaveTimer.current);
        };
    }, [receipts, notes, selectedDate]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: cardClasses + " p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 w-full md:w-auto", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Date" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CalendarIcon, { size: 16, className: "text-slate-400" }), (0, jsx_runtime_1.jsx)("input", { type: "date", className: "rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100", value: selectedDate.toISOString().split("T")[0], onChange: (e) => {
                                            const d = new Date(e.target.value);
                                            if (!isNaN(d.getTime()))
                                                setSelectedDate(d);
                                        } })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-end gap-4", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5", onClick: () => location.reload(), children: "Reset day" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: autosaveStatus === "saved" && savedAt ? `Saved at ${savedAt}` : autosaveStatus || "Autosave paused" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95", onClick: handleSubmit, children: "Submit report" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: cardClasses + " p-6", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold", children: "Quick Stats" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 grid-flow-row-dense", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm opacity-70", children: "Receipts" }), (0, jsx_runtime_1.jsx)("h3", { className: "text-2xl", children: totalReceipts })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm opacity-70", children: "Sales" }), (0, jsx_runtime_1.jsxs)("h3", { className: "text-2xl", children: ["KES ", totalSales.toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm opacity-70", children: "New Products" }), (0, jsx_runtime_1.jsx)("h3", { className: "text-2xl", children: newProducts })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm opacity-70", children: "Products Edited" }), (0, jsx_runtime_1.jsx)("h3", { className: "text-2xl", children: productsEdited })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm opacity-70", children: "Copies Uploaded" }), (0, jsx_runtime_1.jsx)("h3", { className: "text-2xl", children: copiesUploaded })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm opacity-70", children: "Walk\u2011ins Served" }), (0, jsx_runtime_1.jsx)("h3", { className: "text-2xl", children: walkInServed })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm opacity-70", children: "Live Sessions Held" }), (0, jsx_runtime_1.jsx)("h3", { className: "text-2xl", children: liveSessionsCount })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm opacity-70", children: "Commission Earned" }), (0, jsx_runtime_1.jsxs)("h3", { className: "text-2xl", children: ["KES ", commissionEarned.toLocaleString()] })] })] })] }), (0, jsx_runtime_1.jsx)(ReceiptSection, { receipts: receipts, setReceipts: setReceipts, salesErrors: salesErrors }), sections.map((sec) => ((0, jsx_runtime_1.jsx)(DayChecklist, { title: sec.title, items: sec.items, dayKey: dayName.toLowerCase(), dayState: dayState, setDayState: setDayState }, sec.title))), (0, jsx_runtime_1.jsxs)("div", { className: cardClasses + " p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Product & Stock Management" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 grid-flow-row-dense", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Products uploaded (target 50)" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-24 rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100", value: newProducts, onChange: (e) => setNewProducts(parseInt(e.target.value || '0')) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Products edited" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-24 rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100", value: productsEdited, onChange: (e) => setProductsEdited(parseInt(e.target.value || '0')) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Copies uploaded" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-24 rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100", value: copiesUploaded, onChange: (e) => setCopiesUploaded(parseInt(e.target.value || '0')) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Confirmed competitiveness" }), (0, jsx_runtime_1.jsx)("input", { type: "checkbox", className: "h-4 w-4 rounded border-slate-700 bg-black/30 text-emerald-500", checked: Boolean(dayState[dayName.toLowerCase()]?.['pricing_confirmed']), onChange: (e) => setDayState((prev) => ({ ...prev, [dayName.toLowerCase()]: { ...prev[dayName.toLowerCase()], pricing_confirmed: e.target.checked } })) })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: cardClasses + " p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Customer Servicing" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between w-48", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Walk\u2011in customers served" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-20 rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100", value: walkInServed, onChange: (e) => setWalkInServed(parseInt(e.target.value || '0')) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between w-48", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Purchases made" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-20 rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100", value: purchasesMade, onChange: (e) => setPurchasesMade(parseInt(e.target.value || '0')) })] })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400 mt-2", children: "Record visitors and how many completed a purchase." })] }), dayName === "Tuesday" && ((0, jsx_runtime_1.jsxs)("div", { className: cardClasses + " p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Market & Engagement" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Promo videos posted" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-24 rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100", value: promoVideos, onChange: (e) => setPromoVideos(parseInt(e.target.value || '0')) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Demo videos recorded" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-24 rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100", value: demoVideos, onChange: (e) => setDemoVideos(parseInt(e.target.value || '0')) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Engagement replies" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-24 rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100", value: engagementReplies, onChange: (e) => setEngagementReplies(parseInt(e.target.value || '0')) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between md:col-span-3", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "All comments/DMs replied" }), (0, jsx_runtime_1.jsx)("input", { type: "checkbox", className: "h-4 w-4 rounded border-slate-700 bg-black/30 text-emerald-500", checked: allCommentsReplied, onChange: (e) => setAllCommentsReplied(e.target.checked) })] })] })] })), (0, jsx_runtime_1.jsxs)("div", { className: cardClasses + " p-6 space-y-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-semibold", children: "Any concern / comment / complaint / suggestion / improvement" }), (0, jsx_runtime_1.jsx)("textarea", { rows: 4, value: concernsText, onChange: (e) => setConcernsText(e.target.value), className: "w-full rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500", placeholder: "Any additional comments, highlights or issues\u2026" })] })] }));
}
