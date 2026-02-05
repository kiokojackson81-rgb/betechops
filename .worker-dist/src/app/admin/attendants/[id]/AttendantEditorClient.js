"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AttendantEditorClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const getLandingPage_1 = __importDefault(require("@/lib/getLandingPage"));
function AttendantEditorClient({ attendant }) {
    const router = (0, navigation_1.useRouter)();
    const [state, setState] = (0, react_1.useState)({ category: attendant.attendantCategory ?? "", isActive: attendant.isActive, password: "" });
    const [saving, setSaving] = (0, react_1.useState)(false);
    async function save() {
        setSaving(true);
        try {
            const res = await fetch(`/api/users/${attendant.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ attendantCategory: state.category || undefined, isActive: state.isActive }) });
            if (!res.ok)
                throw new Error("save_failed");
            if (state.password) {
                const r2 = await fetch(`/api/users/${attendant.id}/password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: state.password }) });
                if (!r2.ok)
                    throw new Error("password_failed");
            }
            router.refresh();
            alert("Saved");
        }
        catch (err) {
            alert(String(err));
        }
        finally {
            setSaving(false);
        }
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold mb-2", children: "Edit attendant" }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: ["Name: ", (0, jsx_runtime_1.jsx)("strong", { children: attendant.name || "-" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: ["Email: ", (0, jsx_runtime_1.jsx)("strong", { children: attendant.email })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: ["Category: ", (0, jsx_runtime_1.jsx)("strong", { children: attendant.categoryLabel ?? (attendant.attendantCategory ?? "Unassigned") })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4", children: [(0, jsx_runtime_1.jsxs)("select", { className: "col-span-1 rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm", value: state.category ?? "", onChange: (e) => setState((s) => ({ ...s, category: e.target.value })), children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "-- Select category --" }), (0, jsx_runtime_1.jsx)("option", { value: "DIRECT_SALES_OPS", children: "Direct Sales Ops" }), (0, jsx_runtime_1.jsx)("option", { value: "MARKETING_OPS", children: "Marketing Ops" }), (0, jsx_runtime_1.jsx)("option", { value: "JUMIA_KILIMALL_OPS", children: "Jumia / Kilimall Ops" }), (0, jsx_runtime_1.jsx)("option", { value: "SUPPORT_OPS", children: "Support Ops" }), (0, jsx_runtime_1.jsx)("option", { value: "BETECH_OPS", children: "Betech Ops" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: state.isActive, onChange: (e) => setState((s) => ({ ...s, isActive: e.target.checked })) }), " Active"] }), (0, jsx_runtime_1.jsx)("input", { type: "password", placeholder: "New password (optional)", value: state.password, onChange: (e) => setState((s) => ({ ...s, password: e.target.value })), className: "rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-3", children: [(0, jsx_runtime_1.jsx)("button", { onClick: save, disabled: saving, className: "rounded-full bg-emerald-500 px-4 py-2 text-black font-semibold", children: saving ? "Saving…" : "Save" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => {
                            const dest = (0, getLandingPage_1.default)(attendant.attendantCategory || null);
                            router.push(`${dest}?impersonateId=${attendant.id}`);
                        }, className: "rounded-full border border-slate-700 px-4 py-2", children: "Open dashboard" })] })] }));
}
