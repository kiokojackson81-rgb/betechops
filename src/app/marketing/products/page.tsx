import { redirect } from "next/navigation";
import PosManagementClient from "@/app/admin/pos-management/PosManagementClient";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MarketingProductsPage({ searchParams }: ProductsPageProps) {
  const session = await auth();
  const user = session?.user as { email?: string | null; role?: string | null } | undefined;

  if (!user) redirect("/admin/login");

  const email = String(user.email ?? "").trim().toLowerCase();
  const role = String(user.role ?? "").toUpperCase();
  const canManageProducts = email === "brendah@betech.co.ke" || role === "ADMIN" || role === "SUPERVISOR";

  if (!canManageProducts) redirect("/not-authorized");

  const params = (await searchParams) ?? {};
  const editProductParam = params.editProduct;
  const initialEditProductId = Array.isArray(editProductParam)
    ? String(editProductParam[0] ?? "").trim()
    : String(editProductParam ?? "").trim();
  const impersonateIdParam = params.impersonateId;
  const activityOwnerId = role === "ADMIN"
    ? Array.isArray(impersonateIdParam)
      ? String(impersonateIdParam[0] ?? "").trim()
      : String(impersonateIdParam ?? "").trim()
    : null;

  return (
    <div className="mx-auto min-w-0 max-w-[1420px] space-y-5">
      <section className="rounded-[24px] border border-amber-300/15 bg-[linear-gradient(135deg,rgba(245,158,11,.12),rgba(15,23,42,.92)_46%,rgba(2,6,23,.98))] p-4 shadow-2xl shadow-black/20 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/80">Website catalogue</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Manage website products</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Add products, edit descriptions and specifications, manage prices and images, and control which products appear in the online store.
        </p>
      </section>

      <div className="min-w-0 overflow-x-hidden">
        <PosManagementClient
          mode="product-desk"
          initialEditProductId={initialEditProductId || null}
          activityOwnerId={activityOwnerId || null}
        />
      </div>
    </div>
  );
}
