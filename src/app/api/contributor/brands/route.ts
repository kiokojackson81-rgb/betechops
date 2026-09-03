import { noStoreJson } from "@/lib/api";
import { requireProductContributor } from "@/lib/productContributor";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await requireProductContributor();
  if (!access.ok) return access.res;
  const query = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const rows = await prisma.$queryRawUnsafe<Array<{ brand: string }>>(
    `SELECT DISTINCT BTRIM("brand") AS "brand" FROM "Product"
     WHERE "brand" IS NOT NULL AND BTRIM("brand") <> '' AND ($1 = '' OR "brand" ILIKE '%' || $1 || '%')
     UNION
     SELECT DISTINCT BTRIM("shopBrand") AS "brand" FROM "Product"
     WHERE "shopBrand" IS NOT NULL AND BTRIM("shopBrand") <> '' AND ($1 = '' OR "shopBrand" ILIKE '%' || $1 || '%')
     ORDER BY "brand" ASC LIMIT 20`,
    query,
  );
  return noStoreJson({ items: rows.map((row) => row.brand) });
}
