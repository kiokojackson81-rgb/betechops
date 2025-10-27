// app/admin/page.tsx — unified admin console
import AdminTopbar from "./_components/AdminTopbar";
import AdminStatusBanner from "./_components/AdminStatusBanner";
import EndpointConsole from "./_components/jumia/EndpointConsole";
import ShopsHub from "./_components/shops/ShopsHub";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const shops = await prisma.shop.findMany({
    orderBy: { createdAt: "desc" },
    include: { credentials: true, userAssignments: { include: { user: true } } },
  });
  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <AdminTopbar />
      <AdminStatusBanner />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Unified Admin</h1>
        <div className="text-sm text-slate-400">Manage all Jumia/Kilimall shops from one place</div>
      </div>
      <ShopsHub initial={shops} />
      <EndpointConsole />
    </div>
  );
}