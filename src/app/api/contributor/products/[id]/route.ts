import { noStoreJson } from "@/lib/api";
import { requireProductContributor } from "@/lib/productContributor";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateInput = z.object({
  name: z.string().trim().min(2).max(255),
  sellingPrice: z.coerce.number().min(0),
  category: z.string().trim().min(2).max(120),
  shopSubcategory: z.string().trim().max(120).optional().nullable(),
  productType: z.string().trim().max(120).optional().nullable(),
  brand: z.string().trim().max(120).optional().nullable(),
  shortDescription: z.string().trim().max(3000).optional().nullable(),
  description: z.string().trim().max(10000).optional().nullable(),
  warrantyPeriod: z.string().trim().max(120).optional().nullable(),
  warrantyNotes: z.string().trim().max(1000).optional().nullable(),
  tiktokVideoUrl: z.string().trim().url().max(500).optional().nullable(),
  mainImageUrl: z.string().trim().url().max(500),
  galleryImageUrls: z
    .array(z.string().trim().url().max(500))
    .max(12)
    .optional()
    .default([]),
  availabilityType: z
    .enum(["SHOP", "WAREHOUSE", "ORDER_ON_REQUEST", "OUT_OF_STOCK"])
    .default("WAREHOUSE"),
  stockQuantity: z.coerce.number().int().min(0).max(100000).default(0),
  variableCost: z.boolean().default(false),
  lastBuyingPrice: z.coerce.number().min(0).nullable().optional(),
  requiresInstallation: z.boolean().default(false),
  installationIncluded: z.boolean().default(false),
  transportIncluded: z.boolean().default(false),
  zone1TransportFee: z.coerce.number().int().min(0).default(500),
  zone2TransportFee: z.coerce.number().int().min(0).default(750),
  zone3TransportFee: z.coerce.number().int().min(0).default(1000),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireProductContributor();
  if (!access.ok) return access.res;
  const { id } = await params;
  const owner = await prisma.$queryRawUnsafe<Array<{ productId: string }>>(
    `SELECT "productId" FROM "ProductContributorProduct" WHERE "productId" = $1 AND "contributorId" = $2`,
    id,
    access.userId,
  );
  if (!owner[0])
    return noStoreJson({ error: "Product not found" }, { status: 404 });
  const parsed = updateInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;
  const visible = Boolean(data.mainImageUrl);
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      sellingPrice: data.sellingPrice,
      category: data.category,
      brand: data.brand || null,
      shortDescription: data.shortDescription || null,
      description: data.description || null,
      specifications: [],
      warrantyPeriod: data.warrantyPeriod || null,
      warrantyNotes: data.warrantyNotes || null,
      tiktokVideoUrl: data.tiktokVideoUrl || null,
      mainImageUrl: data.mainImageUrl,
      shopImageUrl: data.mainImageUrl,
      galleryImageUrls: data.galleryImageUrls,
      showInShop: visible,
      ecommerceVisible: visible,
      shopCategory: data.category,
      shopSubcategory: data.shopSubcategory || null,
      productType: data.productType || null,
      shopShortDescription: data.shortDescription || null,
      shopWarranty: data.warrantyPeriod || null,
      shopSpecs: null,
      shopBrand: data.brand || null,
      availabilityType: data.availabilityType,
      pickupDelayDays: data.availabilityType === "WAREHOUSE" ? 1 : 0,
      variableCost: data.variableCost,
      lastBuyingPrice: data.variableCost
        ? null
        : (data.lastBuyingPrice ?? null),
      stockQuantity: data.stockQuantity,
      isActive: true,
      status: "ACTIVE",
      posEnabled: true,
      catalogueConfiguration: {
        installationType: data.requiresInstallation
          ? data.installationIncluded
            ? "INCLUDED"
            : "LOCAL_RECOMMENDED"
          : "NOT_REQUIRED",
        installationFeeMode: data.requiresInstallation
          ? data.installationIncluded
            ? "INCLUDED"
            : "STANDARD"
          : "UNAVAILABLE",
        customInstallationFee: null,
        accessoriesMode: "NOT_INCLUDED",
        preliminaryAccessoriesFee: null,
        includedAccessories: "",
        installationNotes: "",
        transportMode: data.transportIncluded ? "INCLUDED" : "ZONE",
        useDefaultTransportRates: false,
        zone1TransportFee: data.zone1TransportFee,
        zone2TransportFee: data.zone2TransportFee,
        zone3TransportFee: data.zone3TransportFee,
        priceIncludes: [
          "EQUIPMENT",
          ...(data.installationIncluded ? ["INSTALLATION"] : []),
          ...(data.transportIncluded ? ["TRANSPORT"] : []),
        ],
        allInclusive: false,
        allInclusiveItems: [],
        structuredSpecifications: [],
        componentWarranties: [],
        projectImageUrls: [],
        requiresSiteAssessment: false,
      },
    },
  });
  await prisma.$executeRawUnsafe(
    `UPDATE "ProductContributorProduct" SET "updatedAt" = NOW() WHERE "productId" = $1`,
    id,
  );
  await prisma.actionLog.create({
    data: {
      actorId: access.userId,
      entity: "Product",
      entityId: id,
      action: "CONTRIBUTOR_PRODUCT_UPDATE",
      after: product,
    },
  });
  return noStoreJson({ ok: true, product });
}
