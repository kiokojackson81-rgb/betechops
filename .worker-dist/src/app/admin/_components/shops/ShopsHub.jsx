"use strict";
// app/admin/_components/shops/ShopsHub.tsx
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ShopsHub;
const AdminShopsClient_1 = __importDefault(require("../../shops/_components/AdminShopsClient"));
const ApiCredentialsManager_1 = __importDefault(require("../../shops/_components/ApiCredentialsManager"));
function ShopsHub({ initial }) {
    return (<div className="grid md:grid-cols-2 gap-6">
      <div className="rounded-xl border border-white/10 bg-[#23272f] p-4">
        <h2 className="text-lg font-semibold mb-2">Shops & Staff</h2>
        <AdminShopsClient_1.default initial={initial.map((s) => ({
            id: s.id,
            name: s.name ?? '',
            platform: s.platform ?? '',
            assignedUser: s.userAssignments && s.userAssignments[0] && s.userAssignments[0].user
                ? { id: s.userAssignments[0].user.id, label: s.userAssignments[0].user.name ?? s.userAssignments[0].user.email ?? '', roleAtShop: s.userAssignments[0].roleAtShop ?? undefined }
                : undefined,
        }))}/>
      </div>
      <div className="rounded-xl border border-white/10 bg-[#23272f] p-4">
        <h2 className="text-lg font-semibold mb-2">API Credentials (per Shop)</h2>
        <ApiCredentialsManager_1.default />
        <p className="text-xs text-slate-400 mt-2">
          For Jumia (Self Authorization), store: <code>apiBase</code> (e.g. https://vendor-api.jumia.com),
          <code>apiKey</code> = Client ID, <code>apiSecret</code> = Refresh Token.
        </p>
      </div>
    </div>);
}
