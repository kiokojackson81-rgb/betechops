"use strict";
"use client";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ShopsList;
const react_1 = __importStar(require("react"));
const UserPicker_1 = __importDefault(require("./UserPicker"));
const ManageAssignments_1 = __importDefault(require("./ManageAssignments"));
const toast_1 = require("@/lib/ui/toast");
function ShopsList({ initial }) {
    const [shops, setShops] = (0, react_1.useState)(initial || []);
    const [prodTotals, setProdTotals] = (0, react_1.useState)({});
    const [openAssign, setOpenAssign] = (0, react_1.useState)(null);
    const [selectedUser, setSelectedUser] = (0, react_1.useState)(null);
    const [roleAtShop, setRoleAtShop] = (0, react_1.useState)('ATTENDANT');
    const [openManage, setOpenManage] = (0, react_1.useState)(null);
    // NEW: per-shop probe results
    const [probe, setProbe] = (0, react_1.useState)({});
    async function testAuth(shopId) {
        setProbe(p => (Object.assign(Object.assign({}, p), { [shopId]: { status: "loading" } })));
        try {
            const res = await fetch(`/api/shops/${shopId}/auth-source`, { method: "POST" });
            const j = await res.json();
            if (!res.ok || !j.ok)
                throw new Error((j === null || j === void 0 ? void 0 : j.error) || `HTTP ${res.status}`);
            setProbe(p => (Object.assign(Object.assign({}, p), { [shopId]: { status: "ok", source: j.source, platform: j.platform } })));
            (0, toast_1.showToast)(`Auth OK (${j.source})`, j.source === "SHOP" ? "success" : "info");
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setProbe(p => (Object.assign(Object.assign({}, p), { [shopId]: { status: "error", message: msg || "failed" } })));
            (0, toast_1.showToast)(`Auth failed: ${msg || "unknown error"}`, "error");
        }
    }
    async function assign(shopId, userId, roleAtShop) {
        const res = await fetch(`/api/shops/${shopId}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, roleAtShop })
        });
        const j = await res.json();
        if (res.ok) {
            setShops((prev) => prev.map((p) => { var _a; return p.id === shopId ? Object.assign(Object.assign({}, p), { assignedUser: { id: userId, label: (_a = selectedUser === null || selectedUser === void 0 ? void 0 : selectedUser.label) !== null && _a !== void 0 ? _a : '', roleAtShop } }) : p; }));
            (0, toast_1.showToast)('Assigned user to shop', 'success');
            setOpenAssign(null);
            setSelectedUser(null);
        }
        else {
            (0, toast_1.showToast)('Error: ' + (j.error || 'failed'), 'error');
        }
    }
    // Load product totals per shop (best-effort)
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        (async () => {
            const list = shops || [];
            for (const s of list) {
                try {
                    const r = await fetch(`/api/debug/jumia/products-count?shopId=${encodeURIComponent(s.id)}&size=1`, { cache: 'no-store' });
                    const j = await r.json();
                    if (!cancelled && r.ok && j && typeof j.total === 'number') {
                        setProdTotals((prev) => (Object.assign(Object.assign({}, prev), { [s.id]: { total: j.total, approx: Boolean(j.approx) } })));
                    }
                }
                catch (_a) {
                    // ignore
                }
            }
        })();
        return () => { cancelled = true; };
    }, [shops]);
    const badge = (p) => {
        if (!p || p.status === "idle")
            return null;
        if (p.status === "loading")
            return <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-white/10">Testing…</span>;
        if (p.status === "error")
            return <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-red-500/20 text-red-300">Error</span>;
        // ok
        const isShop = p.source === "SHOP";
        return (<span className={`ml-2 text-xs rounded-full px-2 py-0.5 ${isShop ? "bg-emerald-500/20 text-emerald-300" : "bg-yellow-500/20 text-yellow-300"}`}>
        {isShop ? "Using SHOP creds" : "Using ENV fallback"}
      </span>);
    };
    return (<div className="space-y-3">
      {shops.map(s => {
            var _a, _b, _c, _d;
            return (<div key={s.id} className="p-3 border rounded flex justify-between items-center">
          <div className="min-w-0">
            <div className="font-medium flex items-center">
              <span className="truncate max-w-[40ch]">{s.name}</span>
              {badge(probe[s.id])}
            </div>
            <div className="text-sm text-slate-500">{s.platform}</div>
            <div className="text-sm text-slate-400">
              Products: {(_b = (_a = prodTotals[s.id]) === null || _a === void 0 ? void 0 : _a.total) !== null && _b !== void 0 ? _b : '…'}{((_c = prodTotals[s.id]) === null || _c === void 0 ? void 0 : _c.approx) ? ' (approx)' : ''}
            </div>
            {s.assignedUser && (<div className="text-sm text-slate-600">
                Assigned: {s.assignedUser.label} {s.assignedUser.roleAtShop ? `(${s.assignedUser.roleAtShop})` : ''}
              </div>)}
          </div>
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 border" onClick={() => setOpenAssign(s.id)}>Assign</button>
            <button className="px-2 py-1 border" onClick={() => setOpenManage(s.id)}>Manage</button>
            {/* NEW: Test Auth */}
            <button className="px-2 py-1 border bg-white/5 hover:bg-white/10" onClick={() => testAuth(s.id)} disabled={((_d = probe[s.id]) === null || _d === void 0 ? void 0 : _d.status) === "loading"} title="Mint a token and show whether SHOP or ENV credentials are used">
              Test Auth
            </button>
          </div>
        </div>);
        })}

      {openAssign && (<div className="p-3 border rounded">
          <h3 className="font-semibold">Assign user to shop</h3>
          <div className="space-x-2 mt-2 flex items-center">
            <UserPicker_1.default onSelect={(u) => setSelectedUser(u)} placeholder="Search user..."/>
            <select value={roleAtShop} onChange={(e) => setRoleAtShop(e.target.value)} className="border p-1 ml-2">
              <option>ATTENDANT</option>
              <option>SUPERVISOR</option>
            </select>
            <button className="px-2 py-1 bg-blue-600 text-white ml-2" onClick={() => {
                if (!selectedUser)
                    return (0, toast_1.showToast)('Select a user', 'warn');
                assign(openAssign, selectedUser.id, roleAtShop);
            }}>
              Save
            </button>
            <button className="ml-2 px-2 py-1" onClick={() => { setOpenAssign(null); setSelectedUser(null); }}>Cancel</button>
          </div>
        </div>)}

      {openManage && (<div className="p-3 border rounded">
          <h3 className="font-semibold">Manage assignments</h3>
          <div className="mt-2">
            <ManageAssignments_1.default shopId={openManage}/>
            <div className="mt-2">
              <button className="px-2 py-1" onClick={() => setOpenManage(null)}>Close</button>
            </div>
          </div>
        </div>)}
    </div>);
}
