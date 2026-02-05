"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = JumiaManualSyncButton;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
function JumiaManualSyncButton({ lookbackDays }) {
    const [status, setStatus] = (0, react_1.useState)("idle");
    const [message, setMessage] = (0, react_1.useState)();
    const handleClick = async () => {
        setStatus("loading");
        setMessage(undefined);
        try {
            const params = new URLSearchParams();
            if (lookbackDays && lookbackDays > 0) {
                params.set("lookbackDays", lookbackDays.toString());
            }
            const dayParam = params.get("day") ? `?day=${encodeURIComponent(params.get("day"))}` : "";
            const response = await fetch(`/api/admin/online/sync-now${dayParam}`, {
                method: "POST",
                cache: "no-store",
                credentials: "include",
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                throw new Error(payload?.error ?? "Sync failed");
            }
            const result = await response.json().catch(() => null);
            setStatus("success");
            setMessage(result?.params ? `Synced ${result.params.lookbackDays ?? "latest"} days` : "Sync completed");
        }
        catch (err) {
            setStatus("error");
            setMessage(err instanceof Error ? err.message : "Unknown error");
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 text-xs", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: "inline-flex items-center justify-center rounded-full border border-emerald-500/50 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50", onClick: handleClick, disabled: status === "loading", children: status === "loading" ? "Syncing…" : "Force sync payout weeks" }), status !== "idle" && message && ((0, jsx_runtime_1.jsx)("span", { className: status === "success"
                    ? "text-emerald-300"
                    : status === "error"
                        ? "text-amber-300"
                        : "text-slate-400", children: message }))] }));
}
