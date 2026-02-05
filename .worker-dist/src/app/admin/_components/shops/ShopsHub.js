"use strict";
// app/admin/_components/shops/ShopsHub.tsx
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ShopsHub;
const jsx_runtime_1 = require("react/jsx-runtime");
const AdminShopsClient_1 = __importDefault(require("../../shops/_components/AdminShopsClient"));
const ApiCredentialsManager_1 = __importDefault(require("../../shops/_components/ApiCredentialsManager"));
function ShopsHub({ initial }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "grid md:grid-cols-2 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/10 bg-[#23272f] p-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold mb-2", children: "Shops & Staff" }), (0, jsx_runtime_1.jsx)(AdminShopsClient_1.default, { initial: initial.map((s) => ({
                            id: s.id,
                            name: s.name ?? '',
                            platform: s.platform ?? '',
                            assignedUser: s.userAssignments && s.userAssignments[0] && s.userAssignments[0].user
                                ? { id: s.userAssignments[0].user.id, label: s.userAssignments[0].user.name ?? s.userAssignments[0].user.email ?? '', roleAtShop: s.userAssignments[0].roleAtShop ?? undefined }
                                : undefined,
                        })) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/10 bg-[#23272f] p-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold mb-2", children: "API Credentials (per Shop)" }), (0, jsx_runtime_1.jsx)(ApiCredentialsManager_1.default, {}), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400 mt-2", children: ["For Jumia (Self Authorization), store: ", (0, jsx_runtime_1.jsx)("code", { children: "apiBase" }), " (e.g. https://vendor-api.jumia.com),", (0, jsx_runtime_1.jsx)("code", { children: "apiKey" }), " = Client ID, ", (0, jsx_runtime_1.jsx)("code", { children: "apiSecret" }), " = Refresh Token."] })] })] }));
}
