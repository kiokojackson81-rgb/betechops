"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = QuickPriceCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const toast_1 = __importDefault(require("@/lib/toast"));
function QuickPriceCard() {
    const [query, setQuery] = (0, react_1.useState)("");
    const [selected, setSelected] = (0, react_1.useState)(null);
    const [buy, setBuy] = (0, react_1.useState)("");
    const margin = (0, react_1.useMemo)(() => {
        if (!selected)
            return null;
        const buying = Number(buy);
        if (!Number.isFinite(buying) || buying <= 0)
            return null;
        const profit = selected.sellingPrice - buying;
        const pct = (profit / selected.sellingPrice) * 100;
        return { profit, pct };
    }, [buy, selected]);
    const money = (v) => `KES ${new Intl.NumberFormat().format(v)}`;
    const search = async () => {
        if (!query.trim())
            return;
        const r = await fetch(`/api/products?search=${encodeURIComponent(query)}`, { cache: "no-store" });
        if (r.ok) {
            const arr = (await r.json());
            setSelected(arr[0] || null);
            if (arr[0]?.lastBuyingPrice)
                setBuy(String(arr[0].lastBuyingPrice));
        }
    };
    const save = async () => {
        if (!selected)
            return;
        const buying = Number(buy);
        if (!Number.isFinite(buying) || buying <= 0)
            return (0, toast_1.default)("Enter a valid buying price > 0", 'error');
        const prev = selected.lastBuyingPrice;
        setSelected({ ...selected, lastBuyingPrice: buying });
        try {
            const r = await fetch(`/api/attendants/orders/price`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId: selected.id, lastBuyingPrice: buying }),
            });
            if (!r.ok)
                throw new Error("save error");
            (0, toast_1.default)("Buying price saved", 'success');
        }
        catch {
            setSelected({ ...selected, lastBuyingPrice: prev });
            (0, toast_1.default)("Failed to save", 'error');
        }
    };
    return ((0, jsx_runtime_1.jsxs)("section", { className: "rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,32,.9),rgba(18,22,32,.7))] p-4 backdrop-blur", children: [(0, jsx_runtime_1.jsx)("h2", { className: "mb-3 text-lg font-semibold", children: "Quick Price Set" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 sm:flex-row", children: [(0, jsx_runtime_1.jsx)("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Scan / type SKU or product name", className: "w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-500" }), (0, jsx_runtime_1.jsx)("button", { onClick: search, className: "rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20", children: "Find" })] }), selected && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-4 grid gap-3 sm:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/10 bg-[#0b0e13] p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: "Product" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm font-medium", children: selected.name }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-500", children: selected.sku })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/10 bg-[#0b0e13] p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: "Selling Price" }), (0, jsx_runtime_1.jsx)("div", { className: "text-lg font-semibold", children: money(selected.sellingPrice) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/10 bg-[#0b0e13] p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: "Buying Price" }), (0, jsx_runtime_1.jsx)("input", { value: buy, onChange: (e) => setBuy(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-transparent px-2 py-1 text-sm outline-none", placeholder: "e.g. 1200" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/10 bg-[#0b0e13] p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: "Profit / Margin" }), margin ? ((0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-sm", children: (0, jsx_runtime_1.jsxs)("span", { className: `${margin.pct >= 15 ? "text-green-300" : margin.pct >= 5 ? "text-yellow-300" : "text-red-300"}`, children: [money(margin.profit), " \u00B7 ", margin.pct.toFixed(1), "%"] }) })) : ((0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-sm text-slate-500", children: "\u2014" }))] })] })), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: save, disabled: !selected, className: "rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-50", children: "Save Buying Price" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => { setQuery(""); setSelected(null); setBuy(""); }, className: "rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/10", children: "Clear" })] })] }));
}
