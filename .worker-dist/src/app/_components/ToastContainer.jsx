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
exports.default = ToastContainer;
const react_1 = __importStar(require("react"));
function ToastContainer() {
    const [items, setItems] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        let idSeq = 1;
        function onToast(e) {
            const ev = e;
            const { message, type } = ev.detail || {};
            const msg = message !== null && message !== void 0 ? message : String(e);
            const tp = type !== null && type !== void 0 ? type : 'info';
            const id = idSeq++;
            setItems((s) => [...s, { id, message: msg, type: tp }]);
            setTimeout(() => setItems((s) => s.filter(x => x.id !== id)), 4000);
        }
        window.addEventListener('betechops:toast', onToast);
        return () => window.removeEventListener('betechops:toast', onToast);
    }, []);
    if (!items.length)
        return null;
    return (<div style={{ position: 'fixed', right: 12, top: 12, zIndex: 9999 }}>
      {items.map(i => (<div key={i.id} style={{ marginBottom: 8, padding: '8px 12px', background: '#111827', color: 'white', borderRadius: 6, minWidth: 220 }}>
          <div style={{ fontSize: 14 }}>{i.message}</div>
        </div>))}
    </div>);
}
