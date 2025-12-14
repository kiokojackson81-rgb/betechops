"use client";
import React from "react";

export default function RestoreConfirmModal({
  open,
  token,
  expiresAt,
  loading,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  token?: string | null;
  expiresAt?: string | null;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token || "");
      // simple feedback
      // eslint-disable-next-line no-alert
      alert("Token copied to clipboard");
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert("Failed to copy token");
    }
  };

  const hasToken = !!token;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="bg-white dark:bg-zinc-900 rounded shadow-lg p-6 z-10 w-[420px]">
        <h3 className="text-lg font-semibold mb-2">{hasToken ? "Confirm Forced Restore" : "Confirm Restore"}</h3>
        {!hasToken && <p className="text-sm mb-3">Confirm that you want to restore receipts/items for this day.</p>}
        {hasToken && <p className="text-sm mb-3">A short-lived confirmation token was generated. Copy it and confirm to proceed with the forced restore.</p>}

        {hasToken && (
          <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded mb-3">
            <div className="flex items-center justify-between">
              <div className="font-mono text-sm break-all">{token}</div>
              <button onClick={handleCopy} className="ml-3 px-2 py-1 bg-slate-200 rounded text-sm">Copy</button>
            </div>
            {expiresAt && <div className="text-xs text-zinc-500 mt-2">Expires: {expiresAt}</div>}
          </div>
        )}

        {error && <div className="text-rose-500 text-sm mb-2">{error}</div>}

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1 rounded border">Cancel</button>
          <button onClick={onConfirm} disabled={!!loading} className="px-3 py-1 rounded bg-emerald-600 text-black">
            {loading ? "Restoring..." : hasToken ? "Confirm & Restore" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
