"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = WipeButtonClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const toast_1 = require("@/lib/ui/toast");
function WipeButtonClient({ entryId }) {
    const [loading, setLoading] = (0, react_1.useState)(false);
    const router = (0, navigation_1.useRouter)();
    const wipe = async () => {
        const ok = await (0, toast_1.confirmDialog)("This will delete all receipts and items for this day. Continue?");
        if (!ok)
            return;
        setLoading(true);
        try {
            const res = await fetch("/api/admin/marketing-report/update-entry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entryId, action: "wipe" }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j?.error || "Wipe failed");
            }
            // refresh to reflect wiped state
            router.refresh();
            (0, toast_1.showToast)("Wipe completed", "success");
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Wipe failed", "error");
        }
        finally {
            setLoading(false);
        }
    };
    return ((0, jsx_runtime_1.jsx)("button", { onClick: wipe, disabled: loading, className: "text-xs text-rose-400 underline hover:text-rose-300", children: loading ? 'Working...' : 'Wipe' }));
}
