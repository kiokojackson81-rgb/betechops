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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AttendantForm;
const react_1 = __importStar(require("react"));
const toast_1 = require("@/lib/ui/toast");
const ShopsActionsContext_1 = require("./ShopsActionsContext");
function AttendantForm({ shops }) {
    const [email, setEmail] = (0, react_1.useState)('');
    const [name, setName] = (0, react_1.useState)('');
    const [shopId, setShopId] = (0, react_1.useState)('');
    const [roleAtShop, setRoleAtShop] = (0, react_1.useState)('ATTENDANT');
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [err, setErr] = (0, react_1.useState)(null);
    const actions = (0, ShopsActionsContext_1.useShopsActionsSafe)();
    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
            const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name }) });
            const j = await res.json();
            if (!res.ok)
                throw new Error(j?.error || 'failed');
            const user = j.user;
            if (shopId) {
                const r2 = await fetch(`/api/shops/${shopId}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, roleAtShop }) });
                const j2 = await r2.json();
                if (!r2.ok)
                    throw new Error(j2?.error || 'assign failed');
            }
            // Notify the user and let a parent update the UI in-place if available.
            setEmail('');
            setName('');
            setShopId('');
            (0, toast_1.showToast)('Attendant created', 'success');
            // Notify parent via context if available (provider optional).
            actions.onAttendantCreated(user, shopId ? { shopId, roleAtShop } : undefined);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setErr(msg);
        }
        finally {
            setBusy(false);
        }
    }
    return (<form onSubmit={submit} className="space-y-2">
      <div>
        <label className="block">Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} className="border p-1" required/>
      </div>
      <div>
        <label className="block">Name</label>
        <input value={name} onChange={e => setName(e.target.value)} className="border p-1"/>
      </div>
      <div>
        <label className="block">Assign to shop (optional)</label>
        <select value={shopId} onChange={e => setShopId(e.target.value)} className="border p-1">
          <option value="">-- none --</option>
          {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {shopId && (<select value={roleAtShop} onChange={e => setRoleAtShop(e.target.value)} className="border p-1 ml-2">
            <option>ATTENDANT</option>
            <option>SUPERVISOR</option>
          </select>)}
      </div>
      {err && <div className="text-red-600">{err}</div>}
      <button type="submit" disabled={busy} className="px-3 py-1 bg-green-600 text-white">Create Attendant</button>
    </form>);
}
