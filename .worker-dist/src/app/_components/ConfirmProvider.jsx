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
exports.default = ConfirmProvider;
const react_1 = __importStar(require("react"));
function ConfirmProvider() {
    const [queue, setQueue] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        function onRequest(e) {
            var _a;
            const ev = e;
            const id = (_a = ev.detail) === null || _a === void 0 ? void 0 : _a.id;
            if (!id)
                return;
            setQueue((q) => [...q, { id: id, message: ev.detail.message || '' }]);
        }
        window.addEventListener('betechops:confirm-request', onRequest);
        return () => window.removeEventListener('betechops:confirm-request', onRequest);
    }, []);
    function respond(id, ok) {
        window.dispatchEvent(new CustomEvent('betechops:confirm-response', { detail: { id, ok } }));
        setQueue((q) => q.filter(x => x.id !== id));
    }
    if (!queue.length)
        return null;
    const top = queue[0];
    return (<div style={{ position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
      <div style={{ background: 'rgba(0,0,0,0.4)', position: 'absolute', inset: 0 }}/>
      <div style={{ background: 'white', padding: 20, borderRadius: 8, zIndex: 100000, minWidth: 320 }}>
        <div style={{ marginBottom: 12 }}>{top.message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={() => respond(top.id, false)} style={{ padding: '8px 12px' }}>Cancel</button>
          <button onClick={() => respond(top.id, true)} style={{ padding: '8px 12px', background: '#2563eb', color: 'white' }}>OK</button>
        </div>
      </div>
    </div>);
}
