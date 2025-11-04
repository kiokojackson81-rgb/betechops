"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = QueueList;
const react_1 = require("react");
const toast_1 = __importDefault(require("@/lib/toast"));
function QueueList({ shopId }) {
    const [rows, setRows] = (0, react_1.useState)(null);
    const [tab, setTab] = (0, react_1.useState)("all");
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [err, setErr] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        let ignore = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const u = new URL("/api/attendants/pending", window.location.origin);
                if (shopId)
                    u.searchParams.set("shopId", shopId);
                const r = await fetch(u.toString(), { cache: "no-store" });
                if (!r.ok)
                    throw new Error(`pending ${r.status}`);
                const j = (await r.json());
                if (!ignore)
                    setRows(j);
            }
            catch (e) {
                if (!ignore)
                    setErr(e?.message || "Failed to load queue");
            }
            finally {
                if (!ignore)
                    setLoading(false);
            }
        })();
        return () => { ignore = true; };
    }, [shopId]);
    const filtered = (0, react_1.useMemo)(() => {
        if (!rows)
            return null;
        switch (tab) {
            case "needs-price":
                return rows.filter((r) => !r.hasBuyingPrice);
            case "unpaid":
                return rows.filter((r) => r.paymentStatus !== "PAID");
            case "ready-pack":
                return rows.filter((r) => r.hasBuyingPrice && r.paymentStatus === "PAID");
            default:
                return rows;
        }
    }, [rows, tab]);
    const timeAgo = (iso) => {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.max(1, Math.round(diff / 60000));
        if (mins < 60)
            return `${mins}m ago`;
        const hrs = Math.round(mins / 60);
        return `${hrs}h ago`;
    };
    const money = (v) => `KES ${new Intl.NumberFormat().format(v)}`;
    const markPacked = async (id) => {
        const prev = rows;
        setRows((s) => s.filter((r) => r.id !== id));
        try {
            const r = await fetch(`/api/orders/${id}/packed`, { method: "POST" });
            if (!r.ok)
                throw new Error("pack error");
        }
        catch {
            setRows(prev);
            (0, toast_1.default)("Failed to mark packed", 'error');
        }
    };
    const confirmPayment = async (id) => {
        const prev = rows;
        setRows((s) => s.map((r) => (r.id === id ? { ...r, paymentStatus: "PAID" } : r)));
        try {
            const r = await fetch(`/api/orders/${id}/payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: "ALL", method: "CASH" }),
            });
            if (!r.ok)
                throw new Error("payment error");
        }
        catch {
            setRows(prev);
            (0, toast_1.default)("Failed to confirm payment", 'error');
        }
    };
    return (<section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,32,.9),rgba(18,22,32,.7))] p-4 backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Today’s Queue</h2>
        <div className="ml-auto flex gap-2 text-xs">
          <Tab label="All" active={tab === "all"} onClick={() => setTab("all")}/>
          <Tab label="Needs Price" active={tab === "needs-price"} onClick={() => setTab("needs-price")}/>
          <Tab label="Unpaid" active={tab === "unpaid"} onClick={() => setTab("unpaid")}/>
          <Tab label="Ready to Pack" active={tab === "ready-pack"} onClick={() => setTab("ready-pack")}/>
        </div>
      </div>

      {loading && <SkeletonRows />}
      {err && <p className="text-sm text-red-300">{err}</p>}

      {!loading && filtered && filtered.length === 0 && (<EmptyState />)}

      {!loading && filtered && filtered.length > 0 && (<ul className="divide-y divide-white/5">
          {filtered.map((o) => (<li key={o.id} className="py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="sm:w-1/2">
                  <div className="text-sm text-slate-400">#{o.orderNumber} • {o.customerName || "Walk-in"}</div>
                  <div className="text-xs text-slate-500">{o.itemsCount} items · {timeAgo(o.createdAt)}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="indigo">{money(o.sellingTotal)}</Chip>
                  <Chip tone={o.hasBuyingPrice ? "green" : "red"}>{o.hasBuyingPrice ? "Price set" : "Needs price"}</Chip>
                  <Chip tone={o.paymentStatus === "PAID" ? "green" : "amber"}>{o.paymentStatus}</Chip>
                </div>

                <div className="ml-auto flex gap-2">
                  <button onClick={() => (window.location.href = `/attendant/pending-pricing?order=${o.id}`)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/10">Price</button>
                  <button onClick={() => confirmPayment(o.id)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/10">Confirm Payment</button>
                  <button onClick={() => markPacked(o.id)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">Mark Packed</button>
                </div>
              </div>
            </li>))}
        </ul>)}
    </section>);
}
function Tab({ label, active, onClick }) {
    return (<button onClick={onClick} className={`rounded-lg px-2.5 py-1 ${active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5"}`}>{label}</button>);
}
function Chip({ children, tone }) {
    const map = {
        green: "bg-green-500/10 text-green-300",
        red: "bg-red-500/10 text-red-300",
        amber: "bg-yellow-500/10 text-yellow-300",
        indigo: "bg-indigo-500/10 text-indigo-300",
    };
    return <span className={`rounded-md px-2 py-0.5 text-xs ${map[tone]}`}>{children}</span>;
}
function SkeletonRows() {
    return (<ul className="divide-y divide-white/5">
      {Array.from({ length: 4 }).map((_, i) => (<li key={i} className="py-3 animate-pulse">
          <div className="h-4 w-1/3 rounded bg-white/10"/>
          <div className="mt-2 h-3 w-1/4 rounded bg-white/5"/>
        </li>))}
    </ul>);
}
function EmptyState() {
    return (<div className="rounded-xl border border-white/10 bg-[#0b0e13] p-6 text-center">
      <div className="mx-auto mb-2 h-10 w-10 rounded-xl bg-white/5"/>
      <div className="text-sm text-slate-400">No pending tasks — great job!</div>
    </div>);
}
