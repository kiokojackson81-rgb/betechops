"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ShopForm;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const toast_1 = require("@/lib/ui/toast");
const ShopsActionsContext_1 = require("./ShopsActionsContext");
function parseJsonWithPosition(input) {
    const text = input.trim();
    if (!text)
        return { valid: true, value: {} };
    try {
        return { valid: true, value: JSON.parse(text) };
    }
    catch (e) {
        // Try to extract line/column from error message if present
        const msg = typeof e === 'object' && e !== null && 'message' in e ? String(e.message ?? 'Invalid JSON') : String(e ?? 'Invalid JSON');
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
        catch {
            (0, toast_1.showToast)("Probe failed", "error");
        }
    }
    async function submit(e) {
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
                    credentials: parsed.value ?? {},
                }),
            });
            async function readResponseSafely(res) {
                const ct = res.headers.get("content-type") || "";
                if (ct.includes("application/json")) {
                    try {
                        return await res.json();
                    }
                    catch {
                        return null;
                    }
                }
                try {
                    const text = await res.text();
                    return { text };
                }
                catch {
                    return null;
                }
            }
            const payload = await readResponseSafely(res);
            if (!res.ok) {
                const payloadObj = payload && typeof payload === 'object' ? payload : null;
                let msg = `HTTP ${res.status}`;
                if (payloadObj) {
                    const maybeErr = payloadObj['error'] ?? payloadObj['message'];
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
            const msg = typeof err === 'object' && err !== null && 'message' in err ? String(err.message ?? 'Create failed') : String(err ?? 'Create failed');
            (0, toast_1.showToast)(msg, "error");
        }
    }
    const badge = parsed.valid ? ((0, jsx_runtime_1.jsx)("span", { className: "ml-2 rounded-full bg-emerald-500/15 text-emerald-300 text-xs px-2 py-0.5 border border-emerald-500/30", children: "JSON: Valid" })) : ((0, jsx_runtime_1.jsx)("span", { className: "ml-2 rounded-full bg-red-500/15 text-red-300 text-xs px-2 py-0.5 border border-red-500/30", children: "JSON: Invalid" }));
    return ((0, jsx_runtime_1.jsxs)("form", { onSubmit: submit, className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium", children: "Name" }), (0, jsx_runtime_1.jsx)("input", { value: name, onChange: (e) => setName(e.target.value), className: "border border-white/15 bg-white/5 rounded px-2 py-1 w-full", placeholder: "e.g., JM Collection", required: true })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium", children: "Platform" }), (0, jsx_runtime_1.jsxs)("select", { value: platform, onChange: (e) => setPlatform(e.target.value), className: "border border-white/15 bg-white/5 rounded px-2 py-1", children: [(0, jsx_runtime_1.jsx)("option", { value: "JUMIA", children: "JUMIA" }), (0, jsx_runtime_1.jsx)("option", { value: "KILIMALL", children: "KILIMALL" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium", children: "Credentials (JSON)" }), badge, (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: probeJson, className: "ml-auto text-xs px-2 py-1 rounded border border-white/15 bg-white/5 hover:bg-white/10", title: "Send the JSON to /api/admin/probe-json for a quick validity check", children: "Probe JSON" })] }), (0, jsx_runtime_1.jsx)("textarea", { value: credentials, onChange: (e) => setCredentials(e.target.value), className: "mt-1 border border-white/15 bg-white/5 rounded px-2 py-1 w-full min-h-[220px] font-mono text-sm" }), !parsed.valid && ((0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-xs text-red-300", children: parsed.error }))] }), (0, jsx_runtime_1.jsx)("button", { type: "submit", disabled: !parsed.valid, className: "px-3 py-2 rounded-xl bg-blue-600 disabled:bg-blue-600/40 text-white", children: "Create Shop" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: ["Tip: The JSON should include ", (0, jsx_runtime_1.jsx)("code", { children: "platform" }), ", ", (0, jsx_runtime_1.jsx)("code", { children: "apiBase" }), ", ", (0, jsx_runtime_1.jsx)("code", { children: "tokenUrl" }), ", ", (0, jsx_runtime_1.jsx)("code", { children: "clientId" }), ", ", (0, jsx_runtime_1.jsx)("code", { children: "refreshToken" }), ", and ", (0, jsx_runtime_1.jsx)("code", { children: "authType" }), "."] })] }));
}
