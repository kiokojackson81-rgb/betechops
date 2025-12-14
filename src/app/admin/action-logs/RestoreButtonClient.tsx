"use client";
import React, { useState } from "react";
import RestoreConfirmModal from "./RestoreConfirmModal";

export default function RestoreButtonClient({ actionLogId }: { actionLogId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const handleRestore = async () => {
    // Open confirmation modal (no token yet)
    setToken(null);
    setExpiresAt(null);
    setModalError(null);
    setShowModal(true);
  };

  const handleModalConfirm = async () => {
    setModalLoading(true);
    setModalError(null);
    try {
      if (!token) {
        // attempt non-forced restore
        const res = await fetch(`/api/admin/action-logs/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionLogId }),
        });
        const data = await res.json();
        if (res.ok) {
          setShowModal(false);
          setDone(true);
          window.location.reload();
          return;
        }

        const msg = (data && data.error) || "Restore failed";
        const needForce = res.status === 409 && /pass force=true|Entry already has receipts/i.test(msg);
        const alreadyRestored = res.status === 409 && /already restored/i.test(msg);
        if (alreadyRestored) {
          setModalError(msg);
          return;
        }
        if (needForce) {
          // request confirmation token and show it in the modal
          const rc = await fetch(`/api/admin/action-logs/restore/request-confirmation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actionLogId }),
          });
          const rcData = await rc.json();
          if (!rc.ok) {
            setModalError(rcData?.error || "Failed to request confirmation");
            return;
          }
          setToken(rcData.token);
          setExpiresAt(rcData.expiresAt);
          // keep modal open so user can copy and confirm
          return;
        }

        setModalError(msg || "Restore failed");
        return;
      }

      // token present -> submit forced restore
      const fr = await fetch(`/api/admin/action-logs/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionLogId, force: true, confirmToken: token }),
      });
      const frData = await fr.json();
      if (!fr.ok) {
        setModalError(frData?.error || "Forced restore failed");
        return;
      }
      setShowModal(false);
      setDone(true);
      window.location.reload();
    } catch (err: any) {
      setModalError(err?.message || "Forced restore failed");
    } finally {
      setModalLoading(false);
    }
  };

  if (done) return <span className="text-emerald-300">Restored</span>;

  return (
    <div>
      <button onClick={handleRestore} disabled={loading} className="text-xs rounded px-2 py-1 bg-emerald-600 text-black">
        {loading ? "Restoring..." : "Restore"}
      </button>
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
