// app/admin/_components/shops/ShopsHub.tsx
"use client";
import AdminShopsClient from "../../shops/_components/AdminShopsClient";
import ApiCredentialsManager from "../../shops/_components/ApiCredentialsManager";

type ShopInitial = {
  id: string;
  name?: string | null;
  platform?: string | null;
  userAssignments?: Array<{
    user?: { id: string; name?: string | null; email?: string | null } | null;
    roleAtShop?: string | null;
  }> | null;
};

export default function ShopsHub({ initial }: { initial: ShopInitial[] }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="rounded-xl border border-white/10 bg-[#23272f] p-4">
        <h2 className="text-lg font-semibold mb-2">Shops & Staff</h2>
        <AdminShopsClient
          initial={initial.map((s) => ({
            id: s.id,
            name: s.name ?? '',
            platform: s.platform ?? '',
            assignedUser: s.userAssignments && s.userAssignments[0] && s.userAssignments[0].user
              ? { id: s.userAssignments[0].user!.id, label: s.userAssignments[0].user!.name ?? s.userAssignments[0].user!.email ?? '', roleAtShop: s.userAssignments[0].roleAtShop ?? undefined }
              : undefined,
          }))}
        />
      </div>
      <div className="rounded-xl border border-white/10 bg-[#23272f] p-4">
        <h2 className="text-lg font-semibold mb-2">API Credentials (per Shop)</h2>
        <ApiCredentialsManager />
        <p className="text-xs text-slate-400 mt-2">
          For Jumia (Self Authorization), store: <code>apiBase</code> (e.g. https://vendor-api.jumia.com),
          <code>apiKey</code> = Client ID, <code>apiSecret</code> = Refresh Token.
        </p>
      </div>
    </div>
  );
}
