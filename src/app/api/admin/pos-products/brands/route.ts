import { noStoreJson, requireRoleOrBrendah } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getDistinctProductBrands } from "@/lib/productBrands";
import { getProductTableCapabilities } from "@/lib/productTableCapabilities";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const capabilities = await getProductTableCapabilities(prisma);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const limit = Number(searchParams.get("limit") || 12);
  const items = await getDistinctProductBrands(prisma, capabilities, { q, limit });

  return noStoreJson({ items });
}
