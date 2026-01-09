"use strict";
"use client";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountAdminPanel = AccountAdminPanel;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const client_1 = require("@prisma/client");
const marketplaceAssignment_1 = __importStar(require("@/lib/marketplaceAssignment"));
const navigation_1 = require("next/navigation");
const toast_1 = require("@/lib/ui/toast");
const inputClasses = "w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400";
function AccountAdminPanel({ accounts, attendants }) {
    const router = (0, navigation_1.useRouter)();
    const [isCreating, startCreating] = (0, react_1.useTransition)();
    const [isAssigning, startAssigning] = (0, react_1.useTransition)();
    const [accountForm, setAccountForm] = (0, react_1.useState)({
        platform: client_1.Platform.JUMIA,
        displayName: "",
        countryCode: "KE",
        currency: "KES",
        jumiaShopSid: "",
        kilimallShopCode: "",
        isActive: true,
    });
    const [assignmentForm, setAssignmentForm] = (0, react_1.useState)({
        accountId: accounts[0]?.id ?? "",
        attendantId: "",
        role: marketplaceAssignment_1.default.JUMIA_KILIMALL_OPS,
        endsAt: "",
    });
    const platformOptions = (0, react_1.useMemo)(() => Object.values(client_1.Platform), []);
    const assignmentRoles = (0, react_1.useMemo)(() => marketplaceAssignment_1.MarketplaceAssignmentRoleValues, []);
    (0, react_1.useEffect)(() => {
        if (accounts.length === 0) {
            if (assignmentForm.accountId) {
                setAssignmentForm((prev) => ({ ...prev, accountId: "" }));
            }
            return;
        }
        const exists = accounts.some((account) => account.id === assignmentForm.accountId);
        if (!assignmentForm.accountId || !exists) {
            setAssignmentForm((prev) => ({ ...prev, accountId: accounts[0].id }));
        }
    }, [accounts, assignmentForm.accountId]);
    const handleCreateAccount = (event) => {
        event.preventDefault();
        if (!accountForm.displayName.trim()) {
            (0, toast_1.showToast)("Display name is required", "error");
            return;
        }
        if (!accountForm.countryCode.trim()) {
            (0, toast_1.showToast)("Country code is required", "error");
            return;
        }
        startCreating(async () => {
            try {
                const payload = {
                    platform: accountForm.platform,
                    displayName: accountForm.displayName.trim(),
                    countryCode: accountForm.countryCode.trim().toUpperCase(),
                    currency: accountForm.currency.trim().toUpperCase(),
                    jumiaShopSid: accountForm.platform === client_1.Platform.JUMIA && accountForm.jumiaShopSid.trim()
                        ? accountForm.jumiaShopSid.trim()
                        : undefined,
                    kilimallShopCode: accountForm.platform === client_1.Platform.KILIMALL && accountForm.kilimallShopCode.trim()
                        ? accountForm.kilimallShopCode.trim()
                        : undefined,
                    isActive: accountForm.isActive,
                };
                const res = await fetch("/api/admin/online/accounts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    throw new Error(data?.error || "Failed to create account");
                }
                (0, toast_1.showToast)("Marketplace account saved", "success");
                setAccountForm((prev) => ({
                    ...prev,
                    displayName: "",
                    jumiaShopSid: "",
                    kilimallShopCode: "",
                }));
                router.refresh();
            }
            catch (err) {
                const message = err instanceof Error ? err.message : "Failed to save account";
                (0, toast_1.showToast)(message, "error");
            }
        });
    };
    const handleAssign = (event) => {
        event.preventDefault();
        if (!assignmentForm.accountId) {
            (0, toast_1.showToast)("Select an account", "error");
            return;
        }
        if (!assignmentForm.attendantId) {
            (0, toast_1.showToast)("Select an attendant", "error");
            return;
        }
        startAssigning(async () => {
            try {
                const payload = {
                    accountId: assignmentForm.accountId,
                    attendantId: assignmentForm.attendantId,
                    role: assignmentForm.role,
                    endsAt: assignmentForm.endsAt ? new Date(assignmentForm.endsAt).toISOString() : null,
                };
                const res = await fetch("/api/admin/online/accounts/assign", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    throw new Error(data?.error || "Failed to assign attendant");
                }
                (0, toast_1.showToast)("Assignment updated", "success");
                setAssignmentForm((prev) => ({ ...prev, attendantId: "", endsAt: "" }));
                router.refresh();
            }
            catch (err) {
                const message = err instanceof Error ? err.message : "Failed to assign attendant";
                (0, toast_1.showToast)(message, "error");
            }
        });
    };
    const disableAssignment = accounts.length === 0 || attendants.length === 0;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "grid gap-6 lg:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("section", { className: "rounded-2xl border border-white/10 bg-slate-900/60 p-5", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-white", children: "Create / update marketplace account" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-sm text-slate-400", children: "Add new Jumia or Kilimall accounts so their payout weeks, orders and returns appear in the dashboards." }), (0, jsx_runtime_1.jsxs)("form", { className: "mt-4 space-y-4", onSubmit: handleCreateAccount, children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 sm:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("span", { className: "mb-1 block text-xs uppercase tracking-wide text-slate-400", children: "Platform" }), (0, jsx_runtime_1.jsx)("select", { className: inputClasses, value: accountForm.platform, onChange: (e) => setAccountForm((prev) => ({ ...prev, platform: e.target.value })), children: platformOptions.map((platform) => ((0, jsx_runtime_1.jsx)("option", { value: platform, children: platform }, platform))) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("span", { className: "mb-1 block text-xs uppercase tracking-wide text-slate-400", children: "Display name" }), (0, jsx_runtime_1.jsx)("input", { className: inputClasses, value: accountForm.displayName, onChange: (e) => setAccountForm((prev) => ({ ...prev, displayName: e.target.value })), placeholder: "eg. Jumia - Wild Tech", required: true })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 sm:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("span", { className: "mb-1 block text-xs uppercase tracking-wide text-slate-400", children: "Country" }), (0, jsx_runtime_1.jsx)("input", { className: inputClasses, value: accountForm.countryCode, onChange: (e) => setAccountForm((prev) => ({ ...prev, countryCode: e.target.value })), placeholder: "KE" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("span", { className: "mb-1 block text-xs uppercase tracking-wide text-slate-400", children: "Currency" }), (0, jsx_runtime_1.jsx)("input", { className: inputClasses, value: accountForm.currency, onChange: (e) => setAccountForm((prev) => ({ ...prev, currency: e.target.value })), placeholder: "KES" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: accountForm.isActive, onChange: (e) => setAccountForm((prev) => ({ ...prev, isActive: e.target.checked })), className: "h-4 w-4 rounded border-slate-700 bg-slate-900" }), (0, jsx_runtime_1.jsx)("span", { children: "Active" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 sm:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("span", { className: "mb-1 block text-xs uppercase tracking-wide text-slate-400", children: "Jumia shop SID" }), (0, jsx_runtime_1.jsx)("input", { className: `${inputClasses} ${accountForm.platform === client_1.Platform.JUMIA ? "" : "opacity-50"}`, value: accountForm.jumiaShopSid, onChange: (e) => setAccountForm((prev) => ({ ...prev, jumiaShopSid: e.target.value })), placeholder: "e.g. shop_12345", disabled: accountForm.platform !== client_1.Platform.JUMIA })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("span", { className: "mb-1 block text-xs uppercase tracking-wide text-slate-400", children: "Kilimall shop code" }), (0, jsx_runtime_1.jsx)("input", { className: `${inputClasses} ${accountForm.platform === client_1.Platform.KILIMALL ? "" : "opacity-50"}`, value: accountForm.kilimallShopCode, onChange: (e) => setAccountForm((prev) => ({ ...prev, kilimallShopCode: e.target.value })), placeholder: "e.g. KLM-WILD01", disabled: accountForm.platform !== client_1.Platform.KILIMALL })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex justify-end", children: (0, jsx_runtime_1.jsx)("button", { type: "submit", disabled: isCreating, className: "inline-flex items-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60", children: isCreating ? "Saving..." : "Save account" }) })] })] }), (0, jsx_runtime_1.jsxs)("section", { className: "rounded-2xl border border-white/10 bg-slate-900/60 p-5", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-white", children: "Attach attendants to accounts" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-sm text-slate-400", children: "Assign attendants or supervisors so pricing queues, payouts and returns are scoped to their accounts." }), (0, jsx_runtime_1.jsxs)("form", { className: "mt-4 space-y-4", onSubmit: handleAssign, children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("span", { className: "mb-1 block text-xs uppercase tracking-wide text-slate-400", children: "Account" }), (0, jsx_runtime_1.jsxs)("select", { className: inputClasses, value: assignmentForm.accountId, onChange: (e) => setAssignmentForm((prev) => ({ ...prev, accountId: e.target.value })), disabled: accounts.length === 0, children: [(0, jsx_runtime_1.jsx)("option", { value: "", disabled: true, children: accounts.length === 0 ? "No accounts yet" : "Select account" }), accounts.map((account) => ((0, jsx_runtime_1.jsxs)("option", { value: account.id, children: [account.displayName, " (", account.platform, ")"] }, account.id)))] })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("span", { className: "mb-1 block text-xs uppercase tracking-wide text-slate-400", children: "Attendant / supervisor" }), (0, jsx_runtime_1.jsxs)("select", { className: inputClasses, value: assignmentForm.attendantId, onChange: (e) => setAssignmentForm((prev) => ({ ...prev, attendantId: e.target.value })), disabled: attendants.length === 0, children: [(0, jsx_runtime_1.jsx)("option", { value: "", disabled: true, children: attendants.length === 0 ? "No attendants found" : "Select attendant" }), attendants.map((attendant) => ((0, jsx_runtime_1.jsxs)("option", { value: attendant.id, children: [attendant.name ?? attendant.email ?? attendant.id, " \u00B7 ", attendant.role, attendant.attendantCategory ? ` / ${attendant.attendantCategory}` : ""] }, attendant.id)))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 sm:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("span", { className: "mb-1 block text-xs uppercase tracking-wide text-slate-400", children: "Role" }), (0, jsx_runtime_1.jsx)("select", { className: inputClasses, value: assignmentForm.role, onChange: (e) => setAssignmentForm((prev) => ({ ...prev, role: e.target.value })), disabled: disableAssignment, children: assignmentRoles.map((role) => ((0, jsx_runtime_1.jsx)("option", { value: role, children: role }, role))) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("span", { className: "mb-1 block text-xs uppercase tracking-wide text-slate-400", children: "Ends at (optional)" }), (0, jsx_runtime_1.jsx)("input", { type: "date", className: inputClasses, value: assignmentForm.endsAt, onChange: (e) => setAssignmentForm((prev) => ({ ...prev, endsAt: e.target.value })), disabled: disableAssignment })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex justify-end", children: (0, jsx_runtime_1.jsx)("button", { type: "submit", disabled: disableAssignment || isAssigning, className: "inline-flex items-center rounded-xl border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-60", children: isAssigning ? "Assigning..." : "Save assignment" }) })] })] })] }));
}
