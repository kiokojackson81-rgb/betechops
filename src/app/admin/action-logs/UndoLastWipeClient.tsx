"use client";
import React, { useState } from "react";
import RestoreConfirmModal from "./RestoreConfirmModal";

export default function UndoLastWipeClient({ lastWipeId }: { lastWipeId?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const handleUndo = async () => {
    if (!lastWipeId) {
      setError("No wipe action found to undo");
      return;
    }
    // open modal to confirm
    setToken(null);
    setExpiresAt(null);
    setModalError(null);
    setShowModal(true);
  };

  const handleModalConfirm = async () => {
    if (!lastWipeId) return;
    setModalLoading(true);
    setModalError(null);
    try {
      if (!token) {
        const res = await fetch(`/api/admin/action-logs/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionLogId: lastWipeId }),
        });
        const data = await res.json();
        if (res.ok) {
          setShowModal(false);
          setDone(true);
          window.location.reload();
          return;
        }

        const msg = (data && data.error) || "Undo failed";
        const needForce = res.status === 409 && /pass force=true|Entry already has receipts/i.test(msg);
        const alreadyRestored = res.status === 409 && /already restored/i.test(msg);
        if (alreadyRestored) {
          setModalError(msg);
          return;
        }
        if (needForce) {
          const rc = await fetch(`/api/admin/action-logs/restore/request-confirmation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actionLogId: lastWipeId }),
          });
          const rcData = await rc.json();
          if (!rc.ok) {
            setModalError(rcData?.error || "Failed to request confirmation");
            return;
          }
          setToken(rcData.token);
          setExpiresAt(rcData.expiresAt);
          return;
        }

        setModalError(msg || "Undo failed");
        return;
      }

      // token present -> submit forced restore
      const fr = await fetch(`/api/admin/action-logs/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionLogId: lastWipeId, force: true, confirmToken: token }),
      });
      const frData = await fr.json();
      if (!fr.ok) {
        setModalError(frData?.error || "Forced undo failed");
        return;
      }
      setShowModal(false);
      setDone(true);
      window.location.reload();
    } catch (err: any) {
      setModalError(err?.message || "Forced undo failed");
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleUndo} disabled={loading || !lastWipeId} className="rounded px-3 py-1 bg-amber-500 text-black text-sm">
        {loading ? "Undoing..." : "Undo last wipe"}
      </button>
      {done && <span className="text-emerald-300 ml-2">Done</span>}
      {error && <div className="text-rose-400 text-xs mt-1">{error}</div>}

      <RestoreConfirmModal
        open={showModal}
        token={token}
        expiresAt={expiresAt}
        loading={modalLoading}
        error={modalError}
        onCancel={() => setShowModal(false)}
        onConfirm={handleModalConfirm}
      />
    </div>
  );
}
