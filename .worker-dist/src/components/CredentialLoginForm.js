"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CredentialLoginForm;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("next-auth/react");
const react_2 = require("react");
const navigation_1 = require("next/navigation");
function CredentialLoginForm({ defaultRedirect, title = "Sign in", description, }) {
    const [email, setEmail] = (0, react_2.useState)("");
    const [password, setPassword] = (0, react_2.useState)("");
    const [busy, setBusy] = (0, react_2.useState)(false);
    const [error, setError] = (0, react_2.useState)(null);
    const params = (0, navigation_1.useSearchParams)();
    const callbackUrl = params?.get("callbackUrl") || defaultRedirect;
    const handleSubmit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        const res = await (0, react_1.signIn)("credentials", {
            redirect: false,
            email,
            password,
            callbackUrl,
        });
        if (res?.ok) {
            if (res.url)
                window.location.href = res.url;
            return;
        }
        setError(res?.error || "Invalid credentials");
        setBusy(false);
    };
    return ((0, jsx_runtime_1.jsxs)("form", { onSubmit: handleSubmit, className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: title }), description ? (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: description }) : null, error ? (0, jsx_runtime_1.jsx)("div", { className: "rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200", children: error }) : null, (0, jsx_runtime_1.jsx)("input", { type: "email", required: true, autoComplete: "email", placeholder: "name@betech.co.ke", value: email, onChange: (e) => setEmail(e.target.value), className: "w-full rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500" }), (0, jsx_runtime_1.jsx)("input", { type: "password", required: true, autoComplete: "current-password", placeholder: "Password", value: password, onChange: (e) => setPassword(e.target.value), className: "w-full rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500" }), (0, jsx_runtime_1.jsx)("button", { type: "submit", disabled: busy, className: "w-full rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-black hover:brightness-95 disabled:opacity-60", children: busy ? "Signing in…" : "Sign in" })] }));
}
