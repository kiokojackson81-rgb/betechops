import { noStoreJson } from "@/lib/api";
import { requireProductContributor } from "@/lib/productContributor";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateInput = z.object({
  name: z.string().trim().min(2).max(255),
  sellingPrice: z.coerce.number().min(0),
  category: z.string().trim().min(2).max(120),
  brand: z.string().trim().max(120).optional().nullable(),
  shortDescription: z.string().trim().max(3000).optional().nullable(),
  description: z.string().trim().max(10000).optional().nullable(),
  specifications: z.array(z.string().trim().max(500)).max(30).optional().default([]),
  warrantyPeriod: z.string().trim().max(120).optional().nullable(),
  warrantyNotes: z.string().trim().max(1000).optional().nullable(),
  mainImageUrl: z.string().trim().url().max(500),
  galleryImageUrls: z.array(z.string().trim().url().max(500)).max(12).optional().default([]),
  availabilityType: z.enum(["SHOP", "WAREHOUSE", "ORDER_ON_REQUEST", "OUT_OF_STOCK"]).default("SHOP"),
  stockQuantity: z.coerce.number().int().min(0).max(100000).default(0),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireProductContributor();
  if (!access.ok) return access.res;
  const { id } = await params;
  const owner = await prisma.$queryRawUnsafe<Array<{ productId: string }>>(
    `SELECT "productId" FROM "ProductContributorProduct" WHERE "productId" = $1 AND "contributorId" = $2`, id, access.userId,
  );
  if (!owner[0]) return noStoreJson({ error: "Product not found" }, { status: 404 });
  const parsed = updateInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;
  const visible = Boolean(data.mainImageUrl);
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: data.name, sellingPrice: data.sellingPrice, category: data.category, brand: data.brand || null,
      shortDescription: data.shortDescription || null, description: data.description || null,
      specifications: data.specifications, warrantyPeriod: data.warrantyPeriod || null, warrantyNotes: data.warrantyNotes || null,
      mainImageUrl: data.mainImageUrl, shopImageUrl: data.mainImageUrl, galleryImageUrls: data.galleryImageUrls,
      showInShop: visible, ecommerceVisible: visible, shopCategory: data.category,
      shopShortDescription: data.shortDescription || null, shopWarranty: data.warrantyPeriod || null,
      shopSpecs: data.specifications.join(", ") || null, shopBrand: data.brand || null,
      availabilityType: data.availabilityType, pickupDelayDays: data.availabilityType === "WAREHOUSE" ? 1 : 0,
      stockQuantity: data.stockQuantity, isActive: true, status: "ACTIVE", posEnabled: true,
    },
  });
  await prisma.$executeRawUnsafe(`UPDATE "ProductContributorProduct" SET "updatedAt" = NOW() WHERE "productId" = $1`, id);
  await prisma.actionLog.create({ data: { actorId: access.userId, entity: "Product", entityId: id, action: "CONTRIBUTOR_PRODUCT_UPDATE", after: product } });
  return noStoreJson({ ok: true, product });
}
