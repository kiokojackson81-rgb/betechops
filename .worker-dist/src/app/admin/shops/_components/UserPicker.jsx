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
exports.default = UserPicker;
const react_1 = __importStar(require("react"));
function UserPicker({ onSelect, placeholder }) {
    const [q, setQ] = (0, react_1.useState)("");
    const [results, setResults] = (0, react_1.useState)([]);
    const [open, setOpen] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        if (!q)
            return setResults([]);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
                if (!res.ok)
                    return setResults([]);
                const j = await res.json();
                setResults(j || []);
                setOpen(true);
            }
            catch {
                setResults([]);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [q]);
    return (<div className="relative inline-block">
      <input value={q} onChange={(e) => { setQ(e.target.value); onSelect(null); }} onFocus={() => q && setOpen(true)} placeholder={placeholder || 'Search user by name or email'} className="border p-1"/>
      {open && results.length > 0 && (<div className="absolute z-20 bg-white border mt-1 max-h-48 overflow-auto w-full shadow">
          {results.map((r) => (<div key={r.id} className="p-2 hover:bg-slate-100 cursor-pointer" onClick={() => { onSelect({ id: r.id, label: `${r.name} <${r.email || ''}>` }); setOpen(false); setQ(''); }}>
              <div className="font-medium">{r.name}</div>
              <div className="text-sm text-slate-500">{r.email}</div>
            </div>))}
        </div>)}
    </div>);
}
