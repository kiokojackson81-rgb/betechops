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
exports.default = ManageAssignments;
const react_1 = __importStar(require("react"));
const toast_1 = require("@/lib/ui/toast");
const toast_2 = require("@/lib/ui/toast");
function ManageAssignments({ shopId }) {
    const [rows, setRows] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            try {
                const res = await fetch(`/api/shops/${shopId}/assignments`);
                if (!res.ok)
                    throw new Error('Failed to load');
                const j = await res.json();
                if (mounted)
                    setRows(j || []);
            }
            catch (_a) {
                (0, toast_1.showToast)('Failed to load assignments', 'error');
            }
            finally {
                if (mounted)
                    setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [shopId]);
    async function remove(userId) {
        // two-step delete confirmation: first click marks pending
        const ok = await (0, toast_2.confirmDialog)(`Remove assignment for user ${userId}?`);
        if (!ok)
            return;
        try {
            const res = await fetch(`/api/shops/${shopId}/assignments`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
            if (!res.ok)
                throw new Error('Delete failed');
            (0, toast_1.showToast)('Removed assignment', 'success');
            // refresh assignments
            const r2 = await fetch(`/api/shops/${shopId}/assignments`);
            if (r2.ok) {
                const j2 = await r2.json();
                setRows(j2 || []);
            }
        }
        catch (_a) {
            (0, toast_1.showToast)('Failed to remove assignment', 'error');
        }
    }
    if (loading)
        return <div>Loading...</div>;
    if (!rows.length)
        return <div className="text-sm text-slate-500">No assignments</div>;
    return (<div className="space-y-2">
      {rows.map(r => {
            var _a;
            return (<div key={r.id} className="flex justify-between items-center p-2 border rounded">
          <div>
            <div className="font-medium">{(_a = r.user.name) !== null && _a !== void 0 ? _a : r.user.email}</div>
            <div className="text-sm text-slate-500">{r.roleAtShop}</div>
          </div>
          <div>
            <button className="text-red-600 px-2 py-1" onClick={() => remove(r.user.id)}>Remove</button>
          </div>
        </div>);
        })}
    </div>);
}
