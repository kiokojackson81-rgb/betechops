"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ShopsList;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const UserPicker_1 = __importDefault(require("./UserPicker"));
const ManageAssignments_1 = __importDefault(require("./ManageAssignments"));
const toast_1 = require("@/lib/ui/toast");
function ShopsList({ initial }) {
    const [shops, setShops] = (0, react_1.useState)(initial || []);
    const [prodTotals, setProdTotals] = (0, react_1.useState)({});
    const [openAssign, setOpenAssign] = (0, react_1.useState)(null);
    const [selectedUser, setSelectedUser] = (0, react_1.useState)(null);
    const [roleAtShop, setRoleAtShop] = (0, react_1.useState)('ATTENDANT');
    const [openManage, setOpenManage] = (0, react_1.useState)(null);
    // NEW: per-shop probe results
    const [probe, setProbe] = (0, react_1.useState)({});
    async function testAuth(shopId) {
        setProbe(p => ({ ...p, [shopId]: { status: "loading" } }));
        try {
            const res = await fetch(`/api/shops/${shopId}/auth-source`, { method: "POST" });
            const j = await res.json();
            if (!res.ok || !j.ok)
                throw new Error(j?.error || `HTTP ${res.status}`);
            setProbe(p => ({ ...p, [shopId]: { status: "ok", source: j.source, platform: j.platform } }));
            (0, toast_1.showToast)(`Auth OK (${j.source})`, j.source === "SHOP" ? "success" : "info");
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setProbe(p => ({ ...p, [shopId]: { status: "error", message: msg || "failed" } }));
            (0, toast_1.showToast)(`Auth failed: ${msg || "unknown error"}`, "error");
        }
    }
    async function assign(shopId, userId, roleAtShop) {
        const res = await fetch(`/api/shops/${shopId}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, roleAtShop })
        });
        const j = await res.json();
        if (res.ok) {
            setShops((prev) => prev.map((p) => p.id === shopId ? { ...p, assignedUser: { id: userId, label: selectedUser?.label ?? '', roleAtShop } } : p));
            (0, toast_1.showToast)('Assigned user to shop', 'success');
            setOpenAssign(null);
            setSelectedUser(null);
        }
        else {
            (0, toast_1.showToast)('Error: ' + (j.error || 'failed'), 'error');
        }
    }
    // Load product totals per shop (best-effort)
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        (async () => {
            const list = shops || [];
            for (const s of list) {
                try {
                    const r = await fetch(`/api/debug/jumia/products-count?shopId=${encodeURIComponent(s.id)}&size=1`, { cache: 'no-store' });
                    const j = await r.json();
                    if (!cancelled && r.ok && j && typeof j.total === 'number') {
                        setProdTotals((prev) => ({ ...prev, [s.id]: { total: j.total, approx: Boolean(j.approx) } }));
                    }
                }
                catch {
                    // ignore
                }
            }
        })();
        return () => { cancelled = true; };
    }, [shops]);
    const badge = (p) => {
        if (!p || p.status === "idle")
            return null;
        if (p.status === "loading")
            return (0, jsx_runtime_1.jsx)("span", { className: "ml-2 text-xs rounded-full px-2 py-0.5 bg-white/10", children: "Testing\u2026" });
        if (p.status === "error")
            return (0, jsx_runtime_1.jsx)("span", { className: "ml-2 text-xs rounded-full px-2 py-0.5 bg-red-500/20 text-red-300", children: "Error" });
        // ok
        const isShop = p.source === "SHOP";
        return ((0, jsx_runtime_1.jsx)("span", { className: `ml-2 text-xs rounded-full px-2 py-0.5 ${isShop ? "bg-emerald-500/20 text-emerald-300" : "bg-yellow-500/20 text-yellow-300"}`, children: isShop ? "Using SHOP creds" : "Using ENV fallback" }));
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [shops.map(s => ((0, jsx_runtime_1.jsxs)("div", { className: "p-3 border rounded flex justify-between items-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "min-w-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "font-medium flex items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "truncate max-w-[40ch]", children: s.name }), badge(probe[s.id])] }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-500", children: s.platform }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-slate-400", children: ["Products: ", prodTotals[s.id]?.total ?? '…', prodTotals[s.id]?.approx ? ' (approx)' : ''] }), s.assignedUser && ((0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-slate-600", children: ["Assigned: ", s.assignedUser.label, " ", s.assignedUser.roleAtShop ? `(${s.assignedUser.roleAtShop})` : ''] }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("button", { className: "px-2 py-1 border", onClick: () => setOpenAssign(s.id), children: "Assign" }), (0, jsx_runtime_1.jsx)("button", { className: "px-2 py-1 border", onClick: () => setOpenManage(s.id), children: "Manage" }), (0, jsx_runtime_1.jsx)("button", { className: "px-2 py-1 border bg-white/5 hover:bg-white/10", onClick: () => testAuth(s.id), disabled: probe[s.id]?.status === "loading", title: "Mint a token and show whether SHOP or ENV credentials are used", children: "Test Auth" })] })] }, s.id))), openAssign && ((0, jsx_runtime_1.jsxs)("div", { className: "p-3 border rounded", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-semibold", children: "Assign user to shop" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-x-2 mt-2 flex items-center", children: [(0, jsx_runtime_1.jsx)(UserPicker_1.default, { onSelect: (u) => setSelectedUser(u), placeholder: "Search user..." }), (0, jsx_runtime_1.jsxs)("select", { value: roleAtShop, onChange: (e) => setRoleAtShop(e.target.value), className: "border p-1 ml-2", children: [(0, jsx_runtime_1.jsx)("option", { children: "ATTENDANT" }), (0, jsx_runtime_1.jsx)("option", { children: "SUPERVISOR" })] }), (0, jsx_runtime_1.jsx)("button", { className: "px-2 py-1 bg-blue-600 text-white ml-2", onClick: () => {
                                    if (!selectedUser)
                                        return (0, toast_1.showToast)('Select a user', 'warn');
                                    assign(openAssign, selectedUser.id, roleAtShop);
                                }, children: "Save" }), (0, jsx_runtime_1.jsx)("button", { className: "ml-2 px-2 py-1", onClick: () => { setOpenAssign(null); setSelectedUser(null); }, children: "Cancel" })] })] })), openManage && ((0, jsx_runtime_1.jsxs)("div", { className: "p-3 border rounded", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-semibold", children: "Manage assignments" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2", children: [(0, jsx_runtime_1.jsx)(ManageAssignments_1.default, { shopId: openManage }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2", children: (0, jsx_runtime_1.jsx)("button", { className: "px-2 py-1", onClick: () => setOpenManage(null), children: "Close" }) })] })] }))] }));
}
