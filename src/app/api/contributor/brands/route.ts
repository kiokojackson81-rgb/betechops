import { noStoreJson } from "@/lib/api";
import { requireProductContributor } from "@/lib/productContributor";
import { prisma } from "@/lib/prisma";
import { getDistinctProductBrands } from "@/lib/productBrands";
import { getProductTableCapabilities } from "@/lib/productTableCapabilities";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await requireProductContributor();
  if (!access.ok) return access.res;
  const query = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const items = await getDistinctProductBrands(
    prisma,
    await getProductTableCapabilities(prisma),
    { q: query, limit: 20 },
  );
  return noStoreJson({ items });
}
