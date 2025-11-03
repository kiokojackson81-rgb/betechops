"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = FinalizePricingButton;
const confirm_1 = __importDefault(require("@/lib/confirm"));
const toast_1 = __importDefault(require("@/lib/toast"));
function FinalizePricingButton({ orderId }) {
    const onClick = async () => {
        const ok = await (0, confirm_1.default)("Finalize pricing and set status = CONFIRMED?");
        if (!ok)
            return;
        const r = await fetch(`/api/orders/${orderId}/finalize-pricing`, { method: "POST" });
        if (!r.ok) {
            (0, toast_1.default)("Failed to finalize", 'error');
            return;
        }
        // Return to list
        window.location.href = "/admin/pending-pricing";
    };
    return (<button onClick={onClick} className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10">
      Finalize Pricing
    </button>);
}
