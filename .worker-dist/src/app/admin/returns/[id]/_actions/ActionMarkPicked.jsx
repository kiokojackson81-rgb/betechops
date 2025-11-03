"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ActionMarkPicked;
const confirm_1 = __importDefault(require("@/lib/confirm"));
const toast_1 = __importDefault(require("@/lib/toast"));
function ActionMarkPicked({ returnId, disabled }) {
    const onClick = async () => {
        if (disabled)
            return;
        const ok = await (0, confirm_1.default)("Mark this return as picked up? This will set status = picked_up.");
        if (!ok)
            return;
        const r = await fetch(`/api/returns/${returnId}/pick`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
        if (!r.ok) {
            (0, toast_1.default)("Failed to mark picked up", "error");
            return;
        }
        (0, toast_1.default)("Return marked as picked", "success");
        window.location.href = "/admin/returns";
    };
    return (<button onClick={onClick} disabled={disabled} className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed">
      Mark Picked Up
    </button>);
}
