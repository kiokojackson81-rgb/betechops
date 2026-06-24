import { noStoreJson, requireRoleOrBrendah } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getProductTableCapabilities } from "@/lib/productTableCapabilities";
import { getDistinctProductBrands, resolveCanonicalProductBrand, toCanonicalBrandName } from "@/lib/productBrands";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createBrandSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function GET(req: Request) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const search = String(searchParams.get("search") || "").trim();
  const limit = Math.max(1, Math.min(Number(searchParams.get("limit") || "12"), 50));
  const capabilities = await getProductTableCapabilities(prisma);
  const items = await getDistinctProductBrands(prisma, capabilities, { q: search, limit });

  return noStoreJson({ items });
}

export async function POST(req: Request) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const parsed = createBrandSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const capabilities = await getProductTableCapabilities(prisma);
  const canonical = toCanonicalBrandName(parsed.data.name);
  if (!canonical) {
    return noStoreJson({ error: "Brand name is required" }, { status: 400 });
  }

  const existing = await resolveCanonicalProductBrand(prisma, capabilities, canonical);

  return noStoreJson({
    item: {
      name: existing ?? canonical,
      created: !existing,
    },
  });
}
