"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = WipeAllButtonClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const toast_1 = require("@/lib/ui/toast");
function WipeAllButtonClient({ userId, periodKey }) {
    const [loading, setLoading] = (0, react_1.useState)(false);
    const router = (0, navigation_1.useRouter)();
    const wipeAll = async () => {
        const ok = await (0, toast_1.confirmDialog)("This will delete receipts for all entries submitted by this attendant in the selected period. Continue?");
        if (!ok)
            return;
        setLoading(true);
        try {
            const res = await fetch('/api/admin/marketing-report/wipe-by-attendant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, tradingPeriodKey: periodKey }),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(j?.error || 'Wipe failed');
            (0, toast_1.showToast)(`Wiped ${j.wiped || 0} entries (batch ${j.batchId || ''})`, 'success');
            router.refresh();
        }
        catch (err) {
            (0, toast_1.showToast)(err?.message || 'Wipe failed', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    return ((0, jsx_runtime_1.jsx)("button", { onClick: wipeAll, disabled: loading, className: "text-xs text-rose-400 underline hover:text-rose-300", children: loading ? 'Working...' : 'Wipe all by attendant' }));
}
