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
exports.default = ReturnPickForm;
const react_1 = __importStar(require("react"));
const toast_1 = __importDefault(require("@/lib/toast"));
async function sha256File(file) {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function ReturnPickForm({ id, shopId }) {
    const [files, setFiles] = (0, react_1.useState)([]);
    const [busy, setBusy] = (0, react_1.useState)(false);
    async function handleUpload() {
        if (!files.length)
            return (0, toast_1.default)('Select files', 'error');
        setBusy(true);
        try {
            for (const f of files) {
                const contentType = f.type || 'application/octet-stream';
                const signRes = await fetch('/api/uploads/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: f.name, contentType, shopId }) });
                const sign = await signRes.json();
                if (!signRes.ok)
                    throw new Error(sign.error || 'sign failed');
                // upload to signed URL
                const put = await fetch(sign.url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: f });
                if (!put.ok)
                    throw new Error('upload failed');
                const sha = await sha256File(f);
                // record evidence
                const evRes = await fetch(`/api/returns/${id}/evidence`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'photo', uri: `s3://${sign.key}`, sha256: sha }) });
                const ev = await evRes.json();
                if (!evRes.ok)
                    throw new Error(ev.error || 'evidence save failed');
            }
            (0, toast_1.default)('Uploaded', 'success');
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            (0, toast_1.default)(msg, 'error');
        }
        finally {
            setBusy(false);
        }
    }
    return (<div className="space-y-2">
      <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))}/>
      <div>
        <button onClick={handleUpload} disabled={busy} className="px-3 py-1 bg-blue-600 text-white">Upload & Attach</button>
      </div>
    </div>);
}
