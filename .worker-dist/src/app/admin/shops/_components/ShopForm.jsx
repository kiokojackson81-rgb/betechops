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
exports.default = ShopForm;
const react_1 = __importStar(require("react"));
const toast_1 = require("@/lib/ui/toast");
const ShopsActionsContext_1 = require("./ShopsActionsContext");
function parseJsonWithPosition(input) {
    var _a;
    const text = input.trim();
    if (!text)
        return { valid: true, value: {} };
    try {
        return { valid: true, value: JSON.parse(text) };
    }
    catch (e) {
        // Try to extract line/column from error message if present
        const msg = typeof e === 'object' && e !== null && 'message' in e ? String((_a = e.message) !== null && _a !== void 0 ? _a : 'Invalid JSON') : String(e !== null && e !== void 0 ? e : 'Invalid JSON');
        // V8 doesn’t give line/col by default; still show raw error
        return { valid: false, error: msg };
    }
}
function ShopForm({ defaultPlatform = "JUMIA" }) {
    const [name, setName] = (0, react_1.useState)("");
    const [platform, setPlatform] = (0, react_1.useState)(defaultPlatform);
    const [credentials, setCredentials] = (0, react_1.useState)(`{
  "platform": "JUMIA",
  "apiBase": "https://vendor-api.jumia.com",
  "base_url": "https://vendor-api.jumia.com",
  "tokenUrl": "https://vendor-api.jumia.com/token",
  "clientId": "d3f5a649-bbcb-4b11-948d-64b1bb036020",
  "refreshToken": "5JKyMUN0hImO8KP70qTCXRp_xmBWekJussuyK7w2T5I",
  "authType": "SELF_AUTHORIZATION",
  "shopLabel": "JM Collection"
}`);
    const parsed = (0, react_1.useMemo)(() => parseJsonWithPosition(credentials), [credentials]);
    const actions = (0, ShopsActionsContext_1.useShopsActionsSafe)();
    async function probeJson() {
        try {
            const r = await fetch("/api/admin/probe-json", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // Send raw JSON text as a string literal for probe
                body: credentials.trim() || "{}",
            });
            const j = await r.json();
            if (j.ok)
                (0, toast_1.showToast)("JSON probe: valid", "success");
            else
                (0, toast_1.showToast)(`JSON probe: ${j.error || "invalid"}`, "error");
        }
        catch (_a) {
            (0, toast_1.showToast)("Probe failed", "error");
        }
    }
    async function submit(e) {
        var _a, _b, _c;
        e.preventDefault();
        if (!name.trim()) {
            (0, toast_1.showToast)("Name is required", "warn");
            return;
        }
        if (!parsed.valid) {
            (0, toast_1.showToast)(`Fix JSON: ${parsed.error}`, "error");
            return;
        }
        try {
            const res = await fetch("/api/shops", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    platform,
                    credentials: (_a = parsed.value) !== null && _a !== void 0 ? _a : {},
                }),
            });
            async function readResponseSafely(res) {
                const ct = res.headers.get("content-type") || "";
                if (ct.includes("application/json")) {
                    try {
                        return await res.json();
                    }
                    catch (_a) {
                        return null;
                    }
                }
                try {
                    const text = await res.text();
                    return { text };
                }
                catch (_b) {
                    return null;
                }
            }
            const payload = await readResponseSafely(res);
            if (!res.ok) {
                const payloadObj = payload && typeof payload === 'object' ? payload : null;
                let msg = `HTTP ${res.status}`;
                if (payloadObj) {
                    const maybeErr = (_b = payloadObj['error']) !== null && _b !== void 0 ? _b : payloadObj['message'];
                    if (typeof maybeErr === 'string')
                        msg = maybeErr;
                    else if ('text' in payloadObj && typeof payloadObj['text'] === 'string')
                        msg = payloadObj['text'];
                }
                throw new Error(msg);
            }
            // success: prefer payload.shop or payload
            const payloadObj = payload && typeof payload === 'object' ? payload : null;
            const shopCandidate = payloadObj ? ('shop' in payloadObj ? payloadObj['shop'] : payloadObj) : null;
            (0, toast_1.showToast)(`Shop created: ${(shopCandidate && typeof shopCandidate === 'object' && 'name' in shopCandidate ? String(shopCandidate['name']) : name)}`, "success");
            setName("");
            if (shopCandidate && typeof shopCandidate === 'object' && 'id' in shopCandidate) {
                const created = shopCandidate;
                actions.onShopCreated(created);
            }
        }
        catch (err) {
            const msg = typeof err === 'object' && err !== null && 'message' in err ? String((_c = err.message) !== null && _c !== void 0 ? _c : 'Create failed') : String(err !== null && err !== void 0 ? err : 'Create failed');
            (0, toast_1.showToast)(msg, "error");
        }
    }
    const badge = parsed.valid ? (<span className="ml-2 rounded-full bg-emerald-500/15 text-emerald-300 text-xs px-2 py-0.5 border border-emerald-500/30">
        JSON: Valid
      </span>) : (<span className="ml-2 rounded-full bg-red-500/15 text-red-300 text-xs px-2 py-0.5 border border-red-500/30">
        JSON: Invalid
      </span>);
    return (<form onSubmit={submit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="border border-white/15 bg-white/5 rounded px-2 py-1 w-full" placeholder="e.g., JM Collection" required/>
      </div>

      <div>
        <label className="block text-sm font-medium">Platform</label>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="border border-white/15 bg-white/5 rounded px-2 py-1">
          <option value="JUMIA">JUMIA</option>
          <option value="KILIMALL">KILIMALL</option>
        </select>
      </div>

      <div>
        <div className="flex items-center">
          <label className="block text-sm font-medium">Credentials (JSON)</label>
          {badge}
          <button type="button" onClick={probeJson} className="ml-auto text-xs px-2 py-1 rounded border border-white/15 bg-white/5 hover:bg-white/10" title="Send the JSON to /api/admin/probe-json for a quick validity check">
            Probe JSON
          </button>
        </div>
        <textarea value={credentials} onChange={(e) => setCredentials(e.target.value)} className="mt-1 border border-white/15 bg-white/5 rounded px-2 py-1 w-full min-h-[220px] font-mono text-sm"/>
        {!parsed.valid && (<div className="mt-1 text-xs text-red-300">
            {parsed.error}
          </div>)}
      </div>

      <button type="submit" disabled={!parsed.valid} className="px-3 py-2 rounded-xl bg-blue-600 disabled:bg-blue-600/40 text-white">
        Create Shop
      </button>

      <div className="text-xs text-slate-400">
        Tip: The JSON should include <code>platform</code>, <code>apiBase</code>, <code>tokenUrl</code>, <code>clientId</code>, <code>refreshToken</code>, and <code>authType</code>.
      </div>
    </form>);
}
