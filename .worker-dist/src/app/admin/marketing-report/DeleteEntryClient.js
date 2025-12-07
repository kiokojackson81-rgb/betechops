"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DeleteEntryClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const toast_1 = require("@/lib/ui/toast");
function DeleteEntryClient({ entryId, entry, onDeleted, onRestore, optimistic = true }) {
    const [loading, setLoading] = (0, react_1.useState)(false);
    const router = (0, navigation_1.useRouter)();
    const remove = async () => {
        const ok = await (0, toast_1.confirmDialog)("This will permanently delete the entire entry (including receipts). Continue?");
        if (!ok)
            return;
        // If optimistic removal is enabled, remove from parent immediately
        if (optimistic && onDeleted) {
            try {
                onDeleted(entryId);
            }
            catch (e) {
                // ignore
            }
        }
        setLoading(true);
        try {
            const res = await fetch("/api/admin/marketing-report/delete-entry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ entryId }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j?.error || "Delete failed");
            }
            (0, toast_1.showToast)("Entry deleted", "success");
            // If not optimistic or parent expects confirmation callback, ensure onDeleted is called.
            if (!optimistic && onDeleted) {
                try {
                    onDeleted(entryId);
                }
                catch (e) {
                    // swallow
                }
            }
            // fallback: if no optimistic handler provided, refresh to update data
            if (!optimistic && !onDeleted) {
                router.refresh();
            }
        }
        catch (err) {
            (0, toast_1.showToast)(err?.message || "Delete failed", "error");
            // rollback optimistic removal if provided
            if (optimistic && onRestore && entry) {
                try {
                    onRestore(entry);
                }
                catch (e) {
                    // swallow
                }
            }
            else if (optimistic && !onRestore) {
                // no rollback handler: refresh to restore data from server
                router.refresh();
            }
        }
        finally {
            setLoading(false);
        }
    };
    return ((0, jsx_runtime_1.jsx)("button", { onClick: remove, disabled: loading, className: "text-xs text-rose-400 underline hover:text-rose-300", children: loading ? "Deleting..." : "Delete" }));
}
