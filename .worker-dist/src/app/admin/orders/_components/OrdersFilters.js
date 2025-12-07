"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = OrdersFilters;
const jsx_runtime_1 = require("react/jsx-runtime");
const navigation_1 = require("next/navigation");
const react_1 = require("react");
const orderStatus_1 = require("@/lib/jumia/orderStatus");
// Note: Jumia API uses American spelling for canceled -> "CANCELED"
const STATUSES = ["PENDING", "PACKED", "READY_TO_SHIP", "DELIVERED", "CANCELED", "RETURNED", "DISPUTED"];
const SIZE_OPTIONS = [25, 50, 100, 150, 200, 250, 300];
const DEFAULTS = {
    status: "PENDING",
    country: "",
    shopId: "ALL",
    dateFrom: "",
    dateTo: "",
    q: "",
    size: "50",
};
function OrdersFilters({ shops }) {
    const pathname = (0, navigation_1.usePathname)();
    const router = (0, navigation_1.useRouter)();
    const sp = (0, navigation_1.useSearchParams)();
    const snapshot = (0, react_1.useMemo)(() => {
        const status = sp?.get("status") || DEFAULTS.status;
        const sizeDefault = (() => {
            if ((0, orderStatus_1.isSyncedStatus)(status)) {
                return status.trim().toUpperCase() === "PENDING" ? "300" : "150";
            }
            return DEFAULTS.size;
        })();
        return {
            status,
            country: sp?.get("country") || DEFAULTS.country,
            shopId: sp?.get("shopId") || DEFAULTS.shopId,
            dateFrom: sp?.get("dateFrom") || DEFAULTS.dateFrom,
            dateTo: sp?.get("dateTo") || DEFAULTS.dateTo,
            q: sp?.get("q") || DEFAULTS.q,
            size: sp?.get("size") || sizeDefault,
        };
    }, [sp]);
    const [pending, setPending] = (0, react_1.useState)(snapshot);
    (0, react_1.useEffect)(() => {
        setPending(snapshot);
    }, [snapshot]);
    const apply = () => {
        // Build query from current pending state (do not start from existing sp to avoid stale deletes)
        const q = new URLSearchParams();
        const assign = (key, value, defaultValue) => {
            if (!value || value === defaultValue) {
                q.delete(key);
            }
            else {
                q.set(key, value);
            }
        };
        assign("status", pending.status, DEFAULTS.status);
        assign("country", pending.country.trim(), DEFAULTS.country);
        assign("shopId", pending.shopId, DEFAULTS.shopId);
        assign("dateFrom", pending.dateFrom, DEFAULTS.dateFrom);
        assign("dateTo", pending.dateTo, DEFAULTS.dateTo);
        assign("q", pending.q.trim(), DEFAULTS.q);
        const sizeDefault = (() => {
            if ((0, orderStatus_1.isSyncedStatus)(pending.status)) {
                return pending.status.trim().toUpperCase() === "PENDING" ? "300" : "150";
            }
            return DEFAULTS.size;
        })();
        assign("size", pending.size, sizeDefault);
        q.delete("nextToken");
        const queryString = q.toString();
        const target = queryString ? `${pathname ?? "/"}?${queryString}` : (pathname ?? "/");
        router.push(target);
    };
    const reset = () => {
        const sizeDefault = (() => {
            if ((0, orderStatus_1.isSyncedStatus)(DEFAULTS.status)) {
                return DEFAULTS.status.trim().toUpperCase() === "PENDING" ? "300" : "150";
            }
            return DEFAULTS.size;
        })();
        setPending({ ...DEFAULTS, size: sizeDefault });
        const q = new URLSearchParams(sp?.toString() || "");
        Object.keys(DEFAULTS).forEach((key) => q.delete(key));
        q.delete("nextToken");
        router.push(`${pathname}?${q.toString()}`);
    };
    const onSubmit = (e) => {
        // Prevent the browser's native submission to avoid a race between router.push and form submit
        // and instead perform a single SPA navigation using the cleaned query built from `pending`.
        e.preventDefault();
        try {
            apply();
        }
        catch (err) {
            // Fallback: log and keep page as-is; native submit is avoided to prevent double navigation.
            // eslint-disable-next-line no-console
            console.error('[OrdersFilters] apply failed', err);
        }
    };
    return ((0, jsx_runtime_1.jsxs)("form", { action: pathname || undefined, method: "GET", onSubmit: onSubmit, className: "rounded-xl border border-white/10 bg-[var(--panel,#121723)] p-4 space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid md:grid-cols-6 gap-3", children: [(0, jsx_runtime_1.jsxs)("select", { name: "status", value: pending.status, onChange: (e) => setPending((prev) => ({ ...prev, status: e.target.value })), className: "border border-white/10 bg-white/5 rounded-lg px-2 py-2", children: [(0, jsx_runtime_1.jsx)("option", { value: "ALL", children: "All Status" }), STATUSES.map((s) => ((0, jsx_runtime_1.jsx)("option", { value: s, children: s }, s)))] }), (0, jsx_runtime_1.jsx)("input", { name: "country", value: pending.country, onChange: (e) => setPending((prev) => ({ ...prev, country: e.target.value })), placeholder: "Country (e.g. KE)", className: "border border-white/10 bg-white/5 rounded-lg px-2 py-2" }), (0, jsx_runtime_1.jsxs)("select", { name: "shopId", value: pending.shopId, onChange: (e) => setPending((prev) => ({ ...prev, shopId: e.target.value })), className: "border border-white/10 bg-white/5 rounded-lg px-2 py-2", children: [(0, jsx_runtime_1.jsx)("option", { value: "ALL", children: "All Jumia" }), shops.map((s) => ((0, jsx_runtime_1.jsx)("option", { value: s.id, children: s.name }, s.id)))] }), (0, jsx_runtime_1.jsx)("input", { type: "date", name: "dateFrom", value: pending.dateFrom, onChange: (e) => setPending((prev) => ({ ...prev, dateFrom: e.target.value })), className: "border border-white/10 bg-white/5 rounded-lg px-2 py-2" }), (0, jsx_runtime_1.jsx)("input", { type: "date", name: "dateTo", value: pending.dateTo, onChange: (e) => setPending((prev) => ({ ...prev, dateTo: e.target.value })), className: "border border-white/10 bg-white/5 rounded-lg px-2 py-2" }), (0, jsx_runtime_1.jsx)("input", { name: "q", value: pending.q, onChange: (e) => setPending((prev) => ({ ...prev, q: e.target.value })), placeholder: "Search number or name.", className: "border border-white/10 bg-white/5 rounded-lg px-2 py-2" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-3", children: [(0, jsx_runtime_1.jsx)("select", { name: "size", value: pending.size, onChange: (e) => setPending((prev) => ({ ...prev, size: e.target.value })), className: "border border-white/10 bg-white/5 rounded-lg px-2 py-2", children: SIZE_OPTIONS.map((n) => ((0, jsx_runtime_1.jsxs)("option", { value: n.toString(), children: [n, " / page"] }, n))) }), (0, jsx_runtime_1.jsx)("button", { type: "submit", className: "px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10", children: "Apply" }), (0, jsx_runtime_1.jsx)("button", { onClick: reset, className: "px-3 py-2 rounded-lg border border-white/10 hover:bg-white/10", children: "Reset" })] })] }));
}
