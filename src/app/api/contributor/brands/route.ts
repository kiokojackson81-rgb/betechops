import { noStoreJson } from "@/lib/api";
import { requireProductContributor } from "@/lib/productContributor";
import { prisma } from "@/lib/prisma";
import {
  findProductBrandMention,
  getDistinctProductBrands,
} from "@/lib/productBrands";
import { getProductTableCapabilities } from "@/lib/productTableCapabilities";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await requireProductContributor();
  if (!access.ok) return access.res;
  const searchParams = new URL(req.url).searchParams;
  const query = searchParams.get("q")?.trim() ?? "";
  const title = searchParams.get("title")?.trim() ?? "";
  const capabilities = await getProductTableCapabilities(prisma);
  if (title) {
    const item = await findProductBrandMention(prisma, capabilities, title);
    return noStoreJson({ item });
  }
  const items = await getDistinctProductBrands(
    prisma,
    capabilities,
    { q: query, limit: 20 },
  );
  return noStoreJson({ items });
}
