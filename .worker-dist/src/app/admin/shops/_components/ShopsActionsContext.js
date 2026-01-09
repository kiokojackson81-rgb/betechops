"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopsActionsProvider = ShopsActionsProvider;
exports.useShopsActions = useShopsActions;
exports.useShopsActionsSafe = useShopsActionsSafe;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const ctx = (0, react_1.createContext)(null);
function ShopsActionsProvider({ children, value }) {
    return (0, jsx_runtime_1.jsx)(ctx.Provider, { value: value, children: children });
}
function useShopsActions() {
    const v = (0, react_1.useContext)(ctx);
    if (!v)
        throw new Error('useShopsActions must be used within ShopsActionsProvider');
    return v;
}
// A safe variant that returns no-op callbacks when the provider is absent.
// This lets client components call it at top-level without having to
// guard against missing providers at runtime.
function useShopsActionsSafe() {
    try {
        return useShopsActions();
    }
    catch {
        return {
            onShopCreated: () => { },
            onAttendantCreated: () => { },
        };
    }
}
