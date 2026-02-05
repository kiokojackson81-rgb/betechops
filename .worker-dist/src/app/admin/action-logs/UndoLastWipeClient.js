"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = UndoLastWipeClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const RestoreConfirmModal_1 = __importDefault(require("./RestoreConfirmModal"));
function UndoLastWipeClient({ lastWipeId }) {
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [done, setDone] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [showModal, setShowModal] = (0, react_1.useState)(false);
    const [token, setToken] = (0, react_1.useState)(null);
    const [expiresAt, setExpiresAt] = (0, react_1.useState)(null);
    const [modalLoading, setModalLoading] = (0, react_1.useState)(false);
    const [modalError, setModalError] = (0, react_1.useState)(null);
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
        if (!lastWipeId)
            return;
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
        }
        catch (err) {
            setModalError(err?.message || "Forced undo failed");
        }
        finally {
            setModalLoading(false);
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("button", { onClick: handleUndo, disabled: loading || !lastWipeId, className: "rounded px-3 py-1 bg-amber-500 text-black text-sm", children: loading ? "Undoing..." : "Undo last wipe" }), done && (0, jsx_runtime_1.jsx)("span", { className: "text-emerald-300 ml-2", children: "Done" }), error && (0, jsx_runtime_1.jsx)("div", { className: "text-rose-400 text-xs mt-1", children: error }), (0, jsx_runtime_1.jsx)(RestoreConfirmModal_1.default, { open: showModal, token: token, expiresAt: expiresAt, loading: modalLoading, error: modalError, onCancel: () => setShowModal(false), onConfirm: handleModalConfirm })] }));
}
