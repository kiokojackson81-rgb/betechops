"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = UnpricedOrdersCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Card_1 = __importDefault(require("@/app/_components/Card"));
const toast_1 = require("@/lib/ui/toast");
function UnpricedOrdersCard({ initialOrders, disableFetch }) {
    const [orders, setOrders] = (0, react_1.useState)(initialOrders ?? []);
    const [status, setStatus] = (0, react_1.useState)("all");
    const [drafts, setDrafts] = (0, react_1.useState)({});
    const [loading, setLoading] = (0, react_1.useState)(true);
    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/online/unpriced-orders?status=${encodeURIComponent(status)}`, { cache: "no-store" });
            if (!res.ok)
                throw new Error("Failed to load unpriced orders");
            const data = await res.json().catch(() => null);
            setOrders(data?.orders ?? []);
            setDrafts({});
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to load unpriced orders", "error");
        }
        finally {
            setLoading(false);
        }
    };
    (0, react_1.useEffect)(() => {
        if (disableFetch) {
            // If fetch is disabled (server provided initialOrders), skip client fetch.
            setLoading(false);
            return;
        }
        fetchOrders();
        window.addEventListener("onlineOps:refresh", fetchOrders);
        return () => window.removeEventListener("onlineOps:refresh", fetchOrders);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    (0, react_1.useEffect)(() => {
        if (disableFetch)
            return;
        fetchOrders();
    }, [status, disableFetch]);
    const handleSave = async (order) => {
        const input = drafts[order.id] ?? "";
        const parsed = Number(input || order.suggestedBuyingPrice || 0);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            (0, toast_1.showToast)("Enter a valid buying price", "warn");
            return;
        }
        try {
            const res = await fetch("/api/online/price-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderItemId: order.orderItemId, buyingPrice: parsed }),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => null);
                throw new Error(error?.error || "Failed to save buying price");
            }
            (0, toast_1.showToast)("Buying price saved", "success");
            setOrders((prev) => prev.filter((item) => item.id !== order.id));
            window.dispatchEvent(new CustomEvent("onlineOps:refresh"));
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to save buying price", "error");
        }
    };
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-4 border-slate-800 bg-slate-900/40 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Orders needing buying price" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Approve costs so profit + commission can be booked." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsxs)("select", { value: status, onChange: (e) => setStatus(e.target.value), className: "rounded-xl bg-white/5 border border-white/10 px-2 py-1 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("option", { value: "all", children: "All unpriced" }), (0, jsx_runtime_1.jsx)("option", { value: "pending", children: "Pending" }), (0, jsx_runtime_1.jsx)("option", { value: "delivered", children: "Delivered" })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5", onClick: fetchOrders, disabled: loading, children: loading ? "Refreshing…" : "Refresh" })] })] }), loading && !orders.length ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/30 p-6 text-sm text-slate-400", children: "Loading unpriced orders\u2026" })) : null, !loading && orders.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/30 p-6 text-sm text-slate-400", children: "All caught up! No pending pricing items." })) : null, (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: orders.map((order) => ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2 rounded-2xl border border-slate-800 bg-slate-950/50 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "font-semibold text-slate-100", children: order.productName }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400", children: [order.accountName, " \u2022 ", order.platform] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-right", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Selling price" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-lg font-semibold text-emerald-400", children: ["KES ", order.sellingPrice.toLocaleString()] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400 mt-1", children: [(0, jsx_runtime_1.jsx)("span", { children: "Seller fee: " }), (0, jsx_runtime_1.jsxs)("span", { className: "text-slate-200", children: ["KES ", (order.sellerFee ?? 0).toLocaleString()] }), (0, jsx_runtime_1.jsx)("span", { className: "mx-2", children: "\u2022" }), (0, jsx_runtime_1.jsx)("span", { children: "Shipping: " }), (0, jsx_runtime_1.jsxs)("span", { className: "text-slate-200", children: ["KES ", (order.shippingFee ?? 0).toLocaleString()] })] })] })] }), order.productUrl ? ((0, jsx_runtime_1.jsx)("a", { href: order.productUrl, target: "_blank", rel: "noreferrer", className: "text-xs text-emerald-400 underline", children: "View listing" })) : null, (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-[1fr_auto]", children: [(0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, placeholder: order.suggestedBuyingPrice ? `Suggested: ${order.suggestedBuyingPrice}` : "Enter buying price", value: drafts[order.id] ?? "", onChange: (e) => setDrafts((prev) => ({ ...prev, [order.id]: e.target.value })), className: "rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-black hover:brightness-95", onClick: () => handleSave(order), children: "Save price" })] })] }, order.id))) })] }));
}
