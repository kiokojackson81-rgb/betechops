"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = RestoreButtonClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const RestoreConfirmModal_1 = __importDefault(require("./RestoreConfirmModal"));
function RestoreButtonClient({ actionLogId }) {
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [done, setDone] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [showModal, setShowModal] = (0, react_1.useState)(false);
    const [token, setToken] = (0, react_1.useState)(null);
    const [expiresAt, setExpiresAt] = (0, react_1.useState)(null);
    const [modalLoading, setModalLoading] = (0, react_1.useState)(false);
    const [modalError, setModalError] = (0, react_1.useState)(null);
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
        }
        catch (err) {
            setModalError(err?.message || "Forced restore failed");
        }
        finally {
            setModalLoading(false);
        }
    };
    if (done)
        return (0, jsx_runtime_1.jsx)("span", { className: "text-emerald-300", children: "Restored" });
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("button", { onClick: handleRestore, disabled: loading, className: "text-xs rounded px-2 py-1 bg-emerald-600 text-black", children: loading ? "Restoring..." : "Restore" }), error && (0, jsx_runtime_1.jsx)("div", { className: "text-rose-400 text-xs mt-1", children: error }), (0, jsx_runtime_1.jsx)(RestoreConfirmModal_1.default, { open: showModal, token: token, expiresAt: expiresAt, loading: modalLoading, error: modalError, onCancel: () => setShowModal(false), onConfirm: handleModalConfirm })] }));
}
