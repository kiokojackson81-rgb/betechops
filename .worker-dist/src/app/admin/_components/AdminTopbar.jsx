"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminTopbar;
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
function AdminTopbar() {
    const [pendingPricing, setPendingPricing] = (0, react_1.useState)(null);
    const [waitingPickup, setWaitingPickup] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        let ignore = false;
        (async () => {
            try {
                const [pp, rp] = await Promise.all([
                    fetch("/api/orders/pending-pricing", { cache: "no-store" })
                        .then(r => r.json()).catch(() => ({ count: 0 })),
                    fetch("/api/returns/waiting-pickup", { cache: "no-store" })
                        .then(r => r.json()).catch(() => ({ count: 0 })),
                ]);
                if (!ignore) {
                    setPendingPricing(typeof pp.count === "number" ? pp.count : 0);
                    setWaitingPickup(typeof rp.count === "number" ? rp.count : 0);
                }
            }
            catch (_a) {
                if (!ignore) {
                    setPendingPricing(0);
                    setWaitingPickup(0);
                }
            }
        })();
        return () => { ignore = true; };
    }, []);
    return (<nav className="flex items-center gap-3 p-3">
      <link_1.default href="/admin" className="px-3 py-1 rounded bg-white/5">Dashboard</link_1.default>
      <link_1.default href="/admin/shops" className="px-3 py-1 rounded bg-white/5">Shops</link_1.default>
      <link_1.default href="/admin/attendants" className="px-3 py-1 rounded bg-white/5">Attendants</link_1.default>

      <link_1.default href="/admin/pending-pricing" className="px-3 py-1 rounded bg-white/5 relative">
        Pending Pricing
        {pendingPricing !== null && (<span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-yellow-500/20 px-2 text-yellow-300 text-xs">
            {pendingPricing}
          </span>)}
      </link_1.default>

      <link_1.default href="/admin/reports" className="px-3 py-1 rounded bg-white/5">Reports</link_1.default>

      <link_1.default href="/admin/returns" className="px-3 py-1 rounded bg-white/5 relative">
        Returns
        {waitingPickup !== null && (<span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-500/20 px-2 text-indigo-300 text-xs">
            {waitingPickup}
          </span>)}
      </link_1.default>
    </nav>);
}
