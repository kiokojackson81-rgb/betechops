"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminTopbarBadges;
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
function AdminTopbarBadges() {
    const [pp, setPP] = (0, react_1.useState)(null);
    const [rp, setRP] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        let ignore = false;
        (async () => {
            try {
                const [a, b] = await Promise.all([
                    fetch("/api/orders/pending-pricing", { cache: "no-store" }).then(r => r.ok ? r.json() : { count: 0 }),
                    fetch("/api/returns/waiting-pickup", { cache: "no-store" }).then(r => r.ok ? r.json() : { count: 0 }),
                ]);
                if (!ignore) {
                    setPP(a.count ?? 0);
                    setRP(b.count ?? 0);
                }
            }
            catch {
                if (!ignore) {
                    setPP(0);
                    setRP(0);
                }
            }
        })();
        return () => { ignore = true; };
    }, []);
    const Badge = ({ href, label, count }) => (<link_1.default href={href} className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 admin-badge">
      <span className="mr-2">{label}</span>
      {count !== null && (<span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-white/10 text-xs">
          {count}
        </span>)}
    </link_1.default>);
    return (<div className="flex items-center gap-2">
      <Badge href="/admin/pending-pricing" label="Pending Pricing" count={pp}/>
      <Badge href="/admin/returns" label="Returns" count={rp}/>
    </div>);
}
