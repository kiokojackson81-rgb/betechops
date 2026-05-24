import { redirect } from "next/navigation";
import { requireRole } from "@/lib/api";
import { getShopImageSlots } from "@/lib/shopImageOverrides";
import ShopImagesManager from "./ShopImagesManager";

export const dynamic = "force-dynamic";

export default async function AdminShopImagesPage() {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) {
    redirect("/admin/login");
  }

  const slots = await getShopImageSlots();

  return (
    <main className="mx-auto max-w-7xl p-6 text-slate-100">
      <ShopImagesManager initialSlots={slots} />
    </main>
  );
}
