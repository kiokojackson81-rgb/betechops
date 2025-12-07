"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DailyReportFinal;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("next-auth/react");
const react_2 = require("react");
const lucide_react_1 = require("lucide-react");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const EarningsCard_1 = __importDefault(require("@/app/_components/EarningsCard"));
const toast_1 = require("@/lib/ui/toast");
const useCardLock_1 = require("@/app/_components/useCardLock");
const SensitiveValue_1 = __importDefault(require("./SensitiveValue"));
const cardClasses = "rounded-2xl border border-white/10 bg-slate-950/70 shadow-lg shadow-black/30";
const inputClasses = "w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
const textareaClasses = "w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
function createEmptyProduct() {
    return {
        id: crypto.randomUUID(),
        name: "",
    };
}
function createEmptyReceipt() {
    return {
        id: crypto.randomUUID(),
        sellingTotal: "",
        receiptNumber: "",
        paymentMethod: "MPESA",
        products: [createEmptyProduct()],
    };
}
function DailyReportFinal() {
    const [date, setDate] = (0, react_2.useState)(() => {
        const d = new Date();
        return d.toISOString().split("T")[0];
    });
    const [dayOfWeek, setDayOfWeek] = (0, react_2.useState)(() => {
        const d = new Date();
        return d.toLocaleDateString("en-KE", { weekday: "long" });
    });
    const [receipts, setReceipts] = (0, react_2.useState)([createEmptyReceipt()]);
    const [walkinsServed, setWalkinsServed] = (0, react_2.useState)("");
    const [walkinsPurchased, setWalkinsPurchased] = (0, react_2.useState)("");
    const [shopNeatness, setShopNeatness] = (0, react_2.useState)({
        cleaned: false,
        neat: false,
        labeled: false,
    });
    const [productsUploaded, setProductsUploaded] = (0, react_2.useState)("");
    const [productsEdited, setProductsEdited] = (0, react_2.useState)("");
    const [productsCopied, setProductsCopied] = (0, react_2.useState)("");
    const [communications, setCommunications] = (0, react_2.useState)({
        repliedFbComments: false,
        repliedFbDms: false,
        repliedIgComments: false,
        repliedIgDms: false,
        clearedFbInbox: false,
        clearedIgInbox: false,
    });
    const [marketplace, setMarketplace] = (0, react_2.useState)({
        stockChecked: false,
        pricingConfirmed: false,
        competitorsReviewed: false,
        oosReview: false,
    });
    const [liveSession, setLiveSession] = (0, react_2.useState)({
        hosted: 0,
        viewers: 0,
        durationMinutes: 0,
        platforms: "",
    });
    const [thursdayActivities, setThursdayActivities] = (0, react_2.useState)({
        attendedMeeting: false,
        attendedShoot: false,
        videosShot: 0,
    });
    const [fridayTasks, setFridayTasks] = (0, react_2.useState)({
        promoVideosPosted: 0,
        preparedWeekendPromos: false,
        improvementSummary: "",
    });
    const [saturdaySummary, setSaturdaySummary] = (0, react_2.useState)({
        liveSessionNotes: "",
        weeklySummary: "",
    });
    const [commissionForPeriod, setCommissionForPeriod] = (0, react_2.useState)(0);
    const [serverQuickStats, setServerQuickStats] = (0, react_2.useState)(null);
    const [earningsSummary, setEarningsSummary] = (0, react_2.useState)(null);
    const [earningsError, setEarningsError] = (0, react_2.useState)(null);
    const [impersonateId, setImpersonateId] = (0, react_2.useState)(null);
    const [isSubmitting, setIsSubmitting] = (0, react_2.useState)(false);
    const [hasValidationErrors] = (0, react_2.useState)(false);
    const [submitError, setSubmitError] = (0, react_2.useState)(null);
    const [submitSuccess, setSubmitSuccess] = (0, react_2.useState)(null);
    const tradingPeriod = (0, tradingPeriod_1.getTradingPeriodFor)(new Date(date));
    const tradingPeriodLabel = tradingPeriod?.label;
    const tradingPeriodKey = tradingPeriod?.key;
    (0, react_2.useEffect)(() => {
        if (typeof window === "undefined")
            return;
        const params = new URLSearchParams(window.location.search);
        setImpersonateId(params.get("impersonateId"));
    }, []);
    const loadEarnings = (0, react_2.useCallback)(async (signal) => {
        if (!tradingPeriodKey)
            return null;
        try {
            const basePath = "/api/attendant/earnings/summary";
            const url = impersonateId ? `${basePath}?impersonateId=${encodeURIComponent(impersonateId)}` : basePath;
            const res = await fetch(url, {
                method: "GET",
                cache: "no-store",
                credentials: "same-origin",
                signal,
            });
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    setEarningsError(null);
                    return null;
                }
                setEarningsError("Failed to load earnings summary.");
                return null;
            }
            const data = await res.json().catch(() => null);
            if (!data)
                return null;
            setEarningsError(null);
            setEarningsSummary(data);
            setCommissionForPeriod(Math.round(data.grossCommission ?? 0));
            setServerQuickStats({
                totalSales: Number(data.totalSales ?? 0),
                totalItems: Number(data.totalItems ?? 0),
                totalNewProducts: Number(data.totalNewProducts ?? 0),
                totalEditedProducts: Number(data.totalEditedProducts ?? 0),
                totalCopiedProducts: Number(data.totalCopiedProducts ?? 0),
                walkInsServed: Number(data.walkInsServed ?? 0),
                walkInsPurchased: Number(data.walkInsPurchased ?? 0),
                totalReceipts: Number(data.totalReceipts ?? 0),
            });
            return data;
        }
        catch (err) {
            if (err.name === "AbortError")
                return null;
            console.error("Failed to load earnings summary", err);
            return null;
        }
    }, [impersonateId, tradingPeriodKey]);
    (0, react_2.useEffect)(() => {
        if (!tradingPeriodKey)
            return;
        const controller = new AbortController();
        loadEarnings(controller.signal);
        return () => controller.abort();
    }, [loadEarnings, tradingPeriodKey]);
    const fetchPeriodSummary = (0, react_2.useCallback)(async (signal) => {
        if (!tradingPeriodKey || typeof window === "undefined")
            return null;
        try {
            const url = new URL("/api/marketing/report/summary", window.location.origin);
            url.searchParams.set("date", date);
            if (impersonateId) {
                url.searchParams.set("impersonateId", impersonateId);
            }
            const res = await fetch(url.toString(), {
                method: "GET",
                cache: "no-store",
                credentials: "same-origin",
                signal,
            });
            if (!res.ok)
                return null;
            const data = await res.json().catch(() => null);
            const commission = data?.aggregates?.commission?.commission;
            if (typeof commission === "number") {
                setCommissionForPeriod(Math.round(commission));
            }
            return data;
        }
        catch (err) {
            if (err.name === "AbortError")
                return null;
            console.error("Failed to load marketing period summary", err);
            return null;
        }
    }, [date, impersonateId, tradingPeriodKey]);
    (0, react_2.useEffect)(() => {
        if (!tradingPeriodKey)
            return;
        const controller = new AbortController();
        fetchPeriodSummary(controller.signal);
        return () => controller.abort();
    }, [fetchPeriodSummary, tradingPeriodKey]);
    const { totalReceipts, totalSales, totalItems, totalNewProducts } = (0, react_2.useMemo)(() => {
        const totalReceipts = receipts.length;
        let totalSales = 0;
        let totalItems = 0;
        receipts.forEach((r) => {
            totalSales += Number(r.sellingTotal || 0);
            totalItems += r.products.length;
        });
        const totalNewProducts = Number(productsUploaded || 0);
        return { totalReceipts, totalSales, totalItems, totalNewProducts };
    }, [receipts, productsUploaded]);
    const totalEditedProducts = Number(productsEdited || 0);
    const totalCopiedProducts = Number(productsCopied || 0);
    const totalWalkinsServed = Number(walkinsServed || 0);
    const totalWalkinsPurchased = Number(walkinsPurchased || 0);
    const serverStats = serverQuickStats;
    const displayedSalesKes = (serverStats?.totalSales ?? 0) + totalSales;
    const displayedItems = (serverStats?.totalItems ?? 0) + totalItems;
    const displayedReceipts = (serverStats?.totalReceipts ?? 0) + totalReceipts;
    const displayedNewProducts = (serverStats?.totalNewProducts ?? 0) + Number(productsUploaded || 0);
    const displayedEditedProducts = (serverStats?.totalEditedProducts ?? 0) + Number(productsEdited || 0);
    const displayedCopiedProducts = (serverStats?.totalCopiedProducts ?? 0) + Number(productsCopied || 0);
    const displayedWalkInsServed = (serverStats?.walkInsServed ?? 0) + Number(walkinsServed || 0);
    const displayedWalkInsPurchased = (serverStats?.walkInsPurchased ?? 0) + Number(walkinsPurchased || 0);
    (0, react_2.useEffect)(() => {
        if (commissionForPeriod === 0 &&
            displayedSalesKes > 0 &&
            displayedSalesKes < 500000) {
            setCommissionForPeriod(Math.round(displayedSalesKes * 0.05));
        }
    }, [commissionForPeriod, displayedSalesKes]);
    // Build a public fallback earnings summary when the server restricts detailed
    // earnings data to authenticated attendants. This lets the UI show a card
    // with basic values even when the user is not signed in.
    const publicFallbackSummary = {
        periodKey: tradingPeriodKey ?? "",
        periodLabel: tradingPeriodLabel ?? "",
        totalSales: serverStats?.totalSales ?? 0,
        totalProfit: 0,
        totalNewProducts: serverStats?.totalNewProducts ?? 0,
        totalEditedProducts: serverStats?.totalEditedProducts ?? 0,
        totalCopiedProducts: serverStats?.totalCopiedProducts ?? 0,
        baseSalary: 0,
        transportAllowance: 0,
        salesCommission: commissionForPeriod,
        newProductCommission: 0,
        copiedCommission: 0,
        editedCommission: 0,
        grossCommission: commissionForPeriod,
        batteryEarnings: 0,
        bonusTotal: 0,
        commissionTopUpTotal: 0,
        chamaTotal: 0,
        latenessTotal: 0,
        disciplineTotal: 0,
        otherDeductionsTotal: 0,
        totalEarnings: commissionForPeriod,
        totalDeductions: 0,
        netPay: commissionForPeriod,
    };
    const updateReceipt = (id, updates) => setReceipts((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    const updateProduct = (receiptId, productId, updates) => {
        setReceipts((prev) => prev.map((r) => r.id === receiptId
            ? {
                ...r,
                products: r.products.map((p) => p.id === productId ? { ...p, ...updates } : p),
            }
            : r));
    };
    const addProductToReceipt = (receiptId) => {
        setReceipts((prev) => prev.map((r) => r.id === receiptId ? { ...r, products: [...r.products, createEmptyProduct()] } : r));
    };
    const removeProductFromReceipt = (receiptId, productId) => {
        setReceipts((prev) => prev.map((r) => r.id === receiptId
            ? {
                ...r,
                products: r.products.length > 1
                    ? r.products.filter((p) => p.id !== productId)
                    : r.products,
            }
            : r));
    };
    const addReceipt = () => setReceipts((prev) => [...prev, createEmptyReceipt()]);
    const removeReceipt = (id) => setReceipts((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
    const salesTotals = {
        receipts: totalReceipts,
        sales: totalSales,
        items: totalItems,
    };
    const handleResetDay = () => {
        setReceipts([createEmptyReceipt()]);
        setWalkinsServed("");
        setWalkinsPurchased("");
        setShopNeatness({ cleaned: false, neat: false, labeled: false });
        setProductsUploaded("");
        setProductsEdited("");
        setProductsCopied("");
        setCommunications({
            repliedFbComments: false,
            repliedFbDms: false,
            repliedIgComments: false,
            repliedIgDms: false,
            clearedFbInbox: false,
            clearedIgInbox: false,
        });
        setMarketplace({
            stockChecked: false,
            pricingConfirmed: false,
            competitorsReviewed: false,
            oosReview: false,
        });
        setLiveSession({ hosted: 0, viewers: 0, durationMinutes: 0, platforms: "" });
        setThursdayActivities({ attendedMeeting: false, attendedShoot: false, videosShot: 0 });
        setFridayTasks({ promoVideosPosted: 0, preparedWeekendPromos: false, improvementSummary: "" });
        setSaturdaySummary({ liveSessionNotes: "", weeklySummary: "" });
    };
    const buildSalesEntries = () => {
        const rows = [];
        receipts.forEach((receipt) => {
            const total = normalizeNumber(receipt.sellingTotal);
            const productCount = receipt.products.length;
            if (productCount === 0) {
                rows.push({
                    productName: receipt.receiptNumber ? `Receipt ${receipt.receiptNumber}` : "Receipt sale",
                    price: total,
                    paymentMethod: receipt.paymentMethod,
                    receiptNumber: receipt.receiptNumber,
                });
                return;
            }
            const base = Math.floor(total / productCount);
            let remainder = total - base * productCount;
            receipt.products.forEach((product, index) => {
                const incremental = base + (remainder > 0 ? 1 : 0);
                if (remainder > 0)
                    remainder -= 1;
                rows.push({
                    productName: product.name || `Product ${index + 1}`,
                    price: incremental,
                    paymentMethod: receipt.paymentMethod,
                    receiptNumber: receipt.receiptNumber,
                });
            });
        });
        return rows;
    };
    const buildTasksPayload = () => ({
        receipts,
        totals: salesTotals,
        walkIns: {
            served: normalizeNumber(walkinsServed),
            purchased: normalizeNumber(walkinsPurchased),
        },
        neatness: shopNeatness,
        productTasks: {
            uploaded: normalizeNumber(productsUploaded),
            edited: normalizeNumber(productsEdited),
            copied: normalizeNumber(productsCopied),
        },
        communications,
        marketplace,
        liveSession,
        thursdayActivities,
        fridayTasks,
        saturdaySummary,
        commissionForPeriod,
        sales: buildSalesEntries(),
    });
    const handleSubmit = async () => {
        if (isSubmitting)
            return;
        setIsSubmitting(true);
        setSubmitError(null);
        setSubmitSuccess(null);
        const tasksPayload = buildTasksPayload();
        const requestBody = {
            date,
            day: dayOfWeek,
            productsCount: salesTotals.items,
            totalSales: salesTotals.sales,
            tasks: tasksPayload,
            newProducts: normalizeNumber(productsUploaded),
            productsEdited: normalizeNumber(productsEdited),
            copiesUploaded: normalizeNumber(productsCopied),
            walkInServed: normalizeNumber(walkinsServed),
            purchasesMade: normalizeNumber(walkinsPurchased),
            liveSessionsCount: normalizeNumber(liveSession.hosted),
            commissionEarned: commissionForPeriod,
            confirmedCompetitiveness: marketplace.pricingConfirmed,
            marketEngagement: {
                communications,
                marketplace,
                liveSession,
            },
            concerns: saturdaySummary.weeklySummary,
        };
        try {
            const endpoint = impersonateId
                ? `/api/daily-report?impersonateId=${encodeURIComponent(impersonateId)}`
                : "/api/daily-report";
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || "Failed to submit daily report");
            }
            (0, toast_1.showToast)("Daily report submitted", "success");
            setSubmitSuccess("Daily report submitted successfully.");
            await loadEarnings();
            await fetchPeriodSummary();
            handleResetDay();
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to submit daily report";
            setSubmitError(message);
            (0, toast_1.showToast)(message, "error");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const datePicker = ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CalendarIcon, { size: 16, className: "text-slate-400" }), (0, jsx_runtime_1.jsx)("input", { type: "date", value: date, onChange: (e) => {
                    setDate(e.target.value);
                    const d = new Date(e.target.value);
                    if (!Number.isNaN(d.getTime())) {
                        setDayOfWeek(d.toLocaleDateString("en-KE", { weekday: "long" }));
                    }
                }, className: inputClasses })] }));
    const dayOfWeekSelect = ((0, jsx_runtime_1.jsx)("select", { value: dayOfWeek, onChange: (e) => setDayOfWeek(e.target.value), className: inputClasses, children: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => ((0, jsx_runtime_1.jsx)("option", { value: day, children: day }, day))) }));
    return ((0, jsx_runtime_1.jsxs)("div", { className: "min-h-screen bg-slate-950 text-slate-50 px-6 py-8 space-y-6", children: [(0, jsx_runtime_1.jsxs)("section", { className: "mb-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-6 rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-4 md:px-8 md:py-5", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl lg:text-3xl font-semibold", children: "Marketing Operations Dashboard" }), (0, jsx_runtime_1.jsx)("p", { className: "text-slate-400 text-sm", children: "Daily tracker for uploads, engagement, walk-ins and live sessions." })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => (0, react_1.signOut)({ callbackUrl: "/attendant/login" }), className: "rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/40 hover:bg-white/10", children: "Log out" })] }) }), (0, jsx_runtime_1.jsx)("section", { className: "mb-6 rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-4 md:px-8 md:py-5", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-4 md:flex-row md:items-center md:gap-8", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex-1", children: (0, jsx_runtime_1.jsx)("label", { className: "block text-xs font-medium uppercase tracking-wide text-slate-400", children: "Date" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "md:flex md:items-center md:justify-end md:gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "md:w-[150px]", children: datePicker }), (0, jsx_runtime_1.jsx)("div", { className: "mt-3 md:mt-0 md:w-[150px]", children: dayOfWeekSelect })] })] }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "lg:col-span-8 space-y-6", children: [(0, jsx_runtime_1.jsx)(SalesReceiptsCard, { receipts: receipts, updateReceipt: updateReceipt, updateProduct: updateProduct, addProductToReceipt: addProductToReceipt, removeProductFromReceipt: removeProductFromReceipt, addReceipt: addReceipt, removeReceipt: removeReceipt, salesTotals: salesTotals }), (0, jsx_runtime_1.jsx)(DaySpecificBlocks, { selectedDay: dayOfWeek, walkIns: totalWalkinsPurchased, onWalkInsChange: (val) => setWalkinsPurchased(val), neatness: shopNeatness, onNeatnessChange: setShopNeatness, productTasks: {
                                    uploaded: Number(productsUploaded || 0),
                                    edited: Number(productsEdited || 0),
                                    copied: Number(productsCopied || 0),
                                }, onProductTasksChange: (val) => {
                                    setProductsUploaded(val.uploaded);
                                    setProductsEdited(val.edited);
                                    setProductsCopied(val.copied);
                                }, communications: communications, onCommunicationsChange: setCommunications, marketplace: marketplace, onMarketplaceChange: setMarketplace, liveSession: liveSession, onLiveSessionChange: setLiveSession, thursdayActivities: thursdayActivities, onThursdayActivitiesChange: setThursdayActivities, fridayTasks: fridayTasks, onFridayTasksChange: setFridayTasks, saturdaySummary: saturdaySummary, onSaturdaySummaryChange: setSaturdaySummary }), submitError && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200", children: submitError })), submitSuccess && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-emerald-700/40 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-200", children: submitSuccess })), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col sm:flex-row justify-end gap-3", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5", onClick: handleResetDay, children: "Reset day" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl bg-emerald-500 px-6 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60", disabled: isSubmitting || hasValidationErrors, onClick: handleSubmit, children: isSubmitting ? "Submitting..." : "Submit report" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "lg:col-span-4 space-y-6", children: [(0, jsx_runtime_1.jsx)(QuickStats, { receipts: displayedReceipts, salesKes: displayedSalesKes, newProducts: displayedNewProducts, editedProducts: displayedEditedProducts, copiedProducts: displayedCopiedProducts, walkInsServed: displayedWalkInsServed, walkInsPurchased: displayedWalkInsPurchased, commissionKes: earningsSummary?.grossCommission ?? commissionForPeriod, tradingPeriodLabel: tradingPeriodLabel }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(EarningsCard_1.default, { summary: earningsSummary ?? publicFallbackSummary, lockKey: "dailyreport:earnings" }), earningsError && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2 rounded-md bg-amber-900/10 px-3 py-2 text-xs text-amber-300", children: [earningsError, " ", "", (0, jsx_runtime_1.jsx)("span", { className: "text-amber-200", children: "Sign in to view your full personalised earnings breakdown." })] }))] })] })] })] }));
}
function SalesReceiptsCard(props) {
    const { receipts, updateReceipt, updateProduct, addProductToReceipt, removeProductFromReceipt, addReceipt, removeReceipt, salesTotals, } = props;
    return ((0, jsx_runtime_1.jsxs)("div", { className: cardClasses + " px-6 py-5 space-y-4", children: [(0, jsx_runtime_1.jsxs)("header", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400", children: "Sales records" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-lg md:text-xl font-semibold", children: "Add each receipt for today" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Totals are calculated automatically." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [receipts.map((receipt, rIndex) => ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4 space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-xs font-semibold uppercase tracking-wide text-slate-400", children: ["Receipt ", rIndex + 1] }), receipts.length > 1 && ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => removeReceipt(receipt.id), className: "text-xs text-slate-400 hover:text-red-400", children: "Remove receipt" }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: "Selling total (KES)" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: receipt.sellingTotal, onChange: (e) => updateReceipt(receipt.id, { sellingTotal: Number(e.target.value || 0) }), className: inputClasses })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: "Receipt number (required)" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: receipt.receiptNumber, onChange: (e) => updateReceipt(receipt.id, { receiptNumber: e.target.value }), placeholder: "Required", className: inputClasses })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: "Payment method (required)" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => updateReceipt(receipt.id, { paymentMethod: "MPESA" }), className: `flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition ${receipt.paymentMethod === "MPESA"
                                                            ? "border-emerald-500 bg-emerald-500 text-black"
                                                            : "border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800"}`, children: "MPESA" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => updateReceipt(receipt.id, { paymentMethod: "CASH" }), className: `flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition ${receipt.paymentMethod === "CASH"
                                                            ? "border-emerald-500 bg-emerald-500 text-black"
                                                            : "border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800"}`, children: "Cash" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: "Products in this receipt" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-2", children: receipt.products.map((p) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 md:grid md:grid-cols-[minmax(0,2fr)_auto] md:items-start", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", placeholder: "Product name", value: p.name, onChange: (e) => updateProduct(receipt.id, p.id, { name: e.target.value }), className: inputClasses }), receipt.products.length > 1 && ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => removeProductFromReceipt(receipt.id, p.id), className: "text-xs text-slate-400 hover:text-red-400 self-end", children: "Remove" }))] }, p.id))) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => addProductToReceipt(receipt.id), className: "mt-1 inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-800", children: "+ Add product to this receipt" })] })] }, receipt.id))), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-3 justify-between", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: addReceipt, className: "rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800", children: "+ Add receipt" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-3 text-xs text-slate-300", children: [(0, jsx_runtime_1.jsxs)("span", { className: "rounded-full bg-slate-900/70 px-3 py-1.5", children: ["Receipts: ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-emerald-400", children: salesTotals.receipts })] }), (0, jsx_runtime_1.jsxs)("span", { className: "rounded-full bg-slate-900/70 px-3 py-1.5", children: ["Sales: ", (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-emerald-400", children: ["KES ", salesTotals.sales.toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("span", { className: "rounded-full bg-slate-900/70 px-3 py-1.5", children: ["Items: ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-emerald-400", children: salesTotals.items })] })] })] })] })] }));
}
function DaySpecificBlocks(props) {
    const { selectedDay, walkIns, onWalkInsChange, neatness, onNeatnessChange, productTasks, onProductTasksChange, communications, onCommunicationsChange, marketplace, onMarketplaceChange, liveSession, onLiveSessionChange, thursdayActivities, onThursdayActivitiesChange, fridayTasks, onFridayTasksChange, saturdaySummary, onSaturdaySummaryChange, } = props;
    const showNeatness = ["Monday", "Thursday", "Friday", "Saturday"].includes(selectedDay);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsx)(WalkInsNeatnessCard, { valueWalkIns: walkIns, onWalkInsChange: onWalkInsChange, neatness: neatness, onNeatnessChange: onNeatnessChange, showNeatness: showNeatness }), (0, jsx_runtime_1.jsx)(ProductStockCard, { productTasks: productTasks, onChange: onProductTasksChange }), (0, jsx_runtime_1.jsx)(CustomerCommunicationsCard, { value: communications, onChange: onCommunicationsChange }), (0, jsx_runtime_1.jsx)(MarketplaceReviewCard, { value: marketplace, onChange: onMarketplaceChange }), selectedDay === "Tuesday" && (0, jsx_runtime_1.jsx)(TuesdayPromoCard, { value: productTasks, onChange: onProductTasksChange }), selectedDay === "Wednesday" && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(LiveSessionCoreCard, { value: liveSession, onChange: onLiveSessionChange }), (0, jsx_runtime_1.jsx)(WednesdayFollowUpCard, {}), (0, jsx_runtime_1.jsx)(WednesdayEngagementCard, {})] })), selectedDay === "Thursday" && ((0, jsx_runtime_1.jsx)(WeeklyMarketingActivitiesCard, { value: thursdayActivities, onChange: onThursdayActivitiesChange })), selectedDay === "Friday" && ((0, jsx_runtime_1.jsx)(FridayPromoTasksCard, { value: fridayTasks, onChange: onFridayTasksChange })), selectedDay === "Saturday" && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(LiveSessionCoreCard, { value: liveSession, onChange: onLiveSessionChange }), (0, jsx_runtime_1.jsx)(SaturdaySummaryCard, { value: saturdaySummary, onChange: onSaturdaySummaryChange })] }))] }));
}
function WalkInsNeatnessCard(props) {
    const { valueWalkIns, onWalkInsChange, neatness, onNeatnessChange, showNeatness } = props;
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Walk-ins & shop neatness" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Walk-ins who purchased" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, className: inputClasses, value: valueWalkIns, onChange: (e) => onWalkInsChange(Number(e.target.value) || 0) })] }), showNeatness && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Shop condition" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 text-sm", children: [(0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: neatness.cleaned, onChange: (e) => onNeatnessChange({ ...neatness, cleaned: e.target.checked }) }), (0, jsx_runtime_1.jsx)("span", { children: "Shop cleaned" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: neatness.neat, onChange: (e) => onNeatnessChange({ ...neatness, neat: e.target.checked }) }), (0, jsx_runtime_1.jsx)("span", { children: "Shop neatness" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: neatness.labeled, onChange: (e) => onNeatnessChange({ ...neatness, labeled: e.target.checked }) }), (0, jsx_runtime_1.jsx)("span", { children: "Display labeled" })] })] })] }))] })] }));
}
function ProductStockCard(props) {
    const { productTasks, onChange } = props;
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Product & stock management" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)(NumberRow, { label: "Products uploaded", value: productTasks.uploaded, onChange: (v) => onChange({ ...productTasks, uploaded: v }) }), (0, jsx_runtime_1.jsx)(NumberRow, { label: "Products edited", value: productTasks.edited, onChange: (v) => onChange({ ...productTasks, edited: v }) }), (0, jsx_runtime_1.jsx)(NumberRow, { label: "Products copied", value: productTasks.copied, onChange: (v) => onChange({ ...productTasks, copied: v }) })] })] }));
}
function CustomerCommunicationsCard(props) {
    const { value, onChange } = props;
    const entries = [
        { label: "Replied to FB comments", key: "repliedFbComments" },
        { label: "Replied to FB DMs", key: "repliedFbDms" },
        { label: "Replied to IG comments", key: "repliedIgComments" },
        { label: "Replied to IG DMs", key: "repliedIgDms" },
        { label: "Cleared FB inbox", key: "clearedFbInbox" },
        { label: "Cleared IG inbox", key: "clearedIgInbox" },
    ];
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-6 space-y-3", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Customer & communications" }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: entries.map((item) => ((0, jsx_runtime_1.jsx)(PillCheckbox, { label: item.label, checked: value[item.key], onChange: (next) => onChange({ ...value, [item.key]: next }) }, item.key))) })] }));
}
function MarketplaceReviewCard(props) {
    const { value, onChange } = props;
    const entries = [
        { label: "Stock checked", key: "stockChecked" },
        { label: "Pricing confirmed", key: "pricingConfirmed" },
        { label: "Competitors reviewed", key: "competitorsReviewed" },
        { label: "Out of stock review", key: "oosReview" },
    ];
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-6 space-y-3", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Marketplace review" }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: entries.map((item) => ((0, jsx_runtime_1.jsx)(PillCheckbox, { label: item.label, checked: value[item.key], onChange: (next) => onChange({ ...value, [item.key]: next }) }, item.key))) })] }));
}
function TuesdayPromoCard(props) {
    const { value, onChange } = props;
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Tuesday \u2013 promo content" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Post product highlights or promotional videos and record at least one demo video for future content scheduling." }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Promo videos / highlights posted" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, className: inputClasses, value: value.uploaded, onChange: (e) => onChange({ ...value, uploaded: Number(e.target.value) || 0 }) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Product demo videos recorded" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, className: inputClasses, value: value.edited, onChange: (e) => onChange({ ...value, edited: Number(e.target.value) || 0 }) })] })] })] }));
}
function LiveSessionCoreCard(props) {
    const { value, onChange } = props;
    const v = value;
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Live session" }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [
                    { label: "Live sessions hosted", key: "hosted" },
                    { label: "Viewers (estimated)", key: "viewers" },
                    { label: "Duration (minutes)", key: "durationMinutes" },
                ].map((field) => ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: field.label }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, className: inputClasses, value: v[field.key], onChange: (e) => onChange({ ...v, [field.key]: Number(e.target.value) || 0 }) })] }, field.key))) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Platform used (TikTok / IG / FB / YT)" }), (0, jsx_runtime_1.jsx)("textarea", { rows: 2, className: textareaClasses, value: v.platforms, onChange: (e) => onChange({ ...v, platforms: e.target.value }) })] })] }));
}
function WednesdayFollowUpCard() {
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-6 space-y-3", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Live session follow-ups" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Conduct timely follow-ups on leads generated from the live session." }), (0, jsx_runtime_1.jsx)("textarea", { rows: 3, className: textareaClasses, placeholder: "Notes on follow-ups, customers contacted, next actions\u2026" })] }));
}
function WednesdayEngagementCard() {
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-6 space-y-3", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Content engagement tracking" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Track engagement data to identify top-performing content (views, comments, saves, shares)." }), (0, jsx_runtime_1.jsx)("textarea", { rows: 3, className: textareaClasses, placeholder: "Top-performing posts, engagement numbers, lessons learnt\u2026" })] }));
}
function WeeklyMarketingActivitiesCard(props) {
    const { value, onChange } = props;
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-6 space-y-5", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Weekly marketing activities (Thursday)" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400 mb-2", children: "Weekly meeting" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-3", children: [(0, jsx_runtime_1.jsx)(TogglePill, { active: value.attendedMeeting, onClick: () => onChange({ ...value, attendedMeeting: true }), children: "Attended weekly marketing meeting" }), (0, jsx_runtime_1.jsx)(TogglePill, { active: !value.attendedMeeting, onClick: () => onChange({ ...value, attendedMeeting: false }), children: "Did not attend" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400 mb-2", children: "Video shoot" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-3", children: [(0, jsx_runtime_1.jsx)(TogglePill, { active: value.attendedShoot, onClick: () => onChange({ ...value, attendedShoot: true }), children: "Participated in weekly video shoot" }), (0, jsx_runtime_1.jsx)(TogglePill, { active: !value.attendedShoot, onClick: () => onChange({ ...value, attendedShoot: false }), children: "Did not participate" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Number of videos participated in (shooting)" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, className: inputClasses, value: value.videosShot, onChange: (e) => onChange({ ...value, videosShot: Number(e.target.value) || 0 }) })] })] })] }));
}
function FridayPromoTasksCard(props) {
    const { value, onChange } = props;
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-6 space-y-5", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Friday \u2013 weekend prep & improvements" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Post engaging product videos or testimonials" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, className: inputClasses, value: value.promoVideosPosted, onChange: (e) => onChange({ ...value, promoVideosPosted: Number(e.target.value) || 0 }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 mt-6 sm:mt-0", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: value.preparedWeekendPromos, onChange: (e) => onChange({ ...value, preparedWeekendPromos: e.target.checked }) }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "Prepare weekend promotions or schedule future posts" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Final improvement suggestions for the week (based on competitor activities)" }), (0, jsx_runtime_1.jsx)("textarea", { rows: 3, className: textareaClasses, value: value.improvementSummary, onChange: (e) => onChange({ ...value, improvementSummary: e.target.value }), placeholder: "Improvements, competitor moves, ideas for next week\u2026" })] })] }));
}
function SaturdaySummaryCard(props) {
    const { value, onChange } = props;
    return ((0, jsx_runtime_1.jsxs)("section", { className: cardClasses + " p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Weekly performance summary" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Submit weekly performance summary including performance suggestions, improvement ideas, complaints or any issues that need management attention." }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Live session highlights / key learnings" }), (0, jsx_runtime_1.jsx)("textarea", { rows: 3, className: textareaClasses, value: value.liveSessionNotes, onChange: (e) => onChange({ ...value, liveSessionNotes: e.target.value }) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Weekly performance summary & issues needing management attention" }), (0, jsx_runtime_1.jsx)("textarea", { rows: 4, className: textareaClasses, value: value.weeklySummary, onChange: (e) => onChange({ ...value, weeklySummary: e.target.value }) })] })] })] }));
}
function TogglePill(props) {
    const { active, onClick, children } = props;
    return ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: onClick, className: "rounded-full px-4 py-2 text-xs sm:text-sm font-medium border transition-colors " +
            (active
                ? "bg-emerald-500 text-black border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.35)]"
                : "bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800"), children: children }));
}
function NumberRow(props) {
    const { label, value, onChange } = props;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-4", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-100", children: label }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: value, onChange: (e) => onChange(e.target.value === "" ? "" : Number(e.target.value)), className: "w-24 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-sm text-right text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" })] }));
}
function QuickStats({ receipts, salesKes, newProducts, editedProducts, copiedProducts, walkInsServed, walkInsPurchased, commissionKes, tradingPeriodLabel, }) {
    const { locked, toggle } = (0, useCardLock_1.useCardLock)("dailyreport:quickstats");
    const mask = (v) => (locked ? "•••" : v);
    return ((0, jsx_runtime_1.jsxs)("section", { className: "rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-6 md:px-8 md:py-7", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-4 md:flex-row md:items-baseline md:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold tracking-tight text-slate-50", children: "Quick stats" }), (0, jsx_runtime_1.jsx)(useCardLock_1.LockButton, { locked: locked, onToggle: toggle })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400 md:text-right", children: tradingPeriodLabel || "TRADING PERIOD 25TH LAST MONTH - 24TH THIS MONTH" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-5 grid gap-3 grid-cols-1 sm:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-900/70 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-[10px] font-medium uppercase tracking-wide text-slate-400", children: "Receipts" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-xl font-semibold text-emerald-400", children: mask(receipts ?? 0) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-900/70 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-[10px] font-medium uppercase tracking-wide text-slate-400", children: "Sales (KES)" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-xl font-semibold text-emerald-400", children: mask(salesKes?.toLocaleString() ?? "0") })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-900/70 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-[10px] font-medium uppercase tracking-wide text-slate-400", children: "New products" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-xl font-semibold text-emerald-400", children: mask(newProducts ?? 0) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-900/70 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-[10px] font-medium uppercase tracking-wide text-slate-400", children: "Edited products" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-xl font-semibold text-emerald-400", children: mask(editedProducts ?? 0) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-900/70 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-[10px] font-medium uppercase tracking-wide text-slate-400", children: "Copied products" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-xl font-semibold text-emerald-400", children: mask(copiedProducts ?? 0) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-900/70 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-[10px] font-medium uppercase tracking-wide text-slate-400", children: "Commission (KES)" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-xl font-semibold text-emerald-400", children: (0, jsx_runtime_1.jsx)(SensitiveValue_1.default, { value: commissionKes ?? 0, format: (v) => Number(v).toLocaleString(), storageKey: `dailyreport:commission`, forceHidden: locked, forceVisible: !locked }) })] })] })] }));
}
function PillCheckbox(props) {
    const { label, checked, onChange } = props;
    return ((0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium border transition-colors " +
            (checked
                ? "bg-emerald-500 text-black border-emerald-500"
                : "bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800"), children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: checked, onChange: (e) => onChange(e.target.checked), className: "hidden" }), (0, jsx_runtime_1.jsx)("span", { children: label })] }));
}
const normalizeNumber = (value) => {
    if (typeof value === "number")
        return value;
    if (value === "" || typeof value === "undefined")
        return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
