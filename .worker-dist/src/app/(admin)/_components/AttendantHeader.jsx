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
exports.default = AttendantHeader;
const react_1 = __importStar(require("react"));
function AttendantHeader({ user }) {
    var _a;
    const [kpis, setKpis] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        let mounted = true;
        async function load() {
            try {
                const res = await fetch('/api/metrics/kpis');
                if (!res.ok)
                    return;
                const data = await res.json();
                if (mounted)
                    setKpis(data);
            }
            catch (_a) {
                // ignore
            }
        }
        void load();
        return () => { mounted = false; };
    }, []);
    return (<header style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Attendant</h2>
          <p style={{ margin: 0, color: '#6b7280' }}>{(_a = user === null || user === void 0 ? void 0 : user.name) !== null && _a !== void 0 ? _a : '—'}</p>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Queued</div>
            <div style={{ fontWeight: 600 }}>{kpis ? kpis.queued : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Today Packed</div>
            <div style={{ fontWeight: 600 }}>{kpis ? kpis.todayPacked : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>RTS</div>
            <div style={{ fontWeight: 600 }}>{kpis ? kpis.rts : '—'}</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 8, color: '#9ca3af', fontSize: 13 }}>Live KPIs powered by /api/metrics/kpis</div>
    </header>);
}
