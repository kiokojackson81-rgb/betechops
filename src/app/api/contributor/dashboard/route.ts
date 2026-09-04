import { noStoreJson } from "@/lib/api";
import {
  getContributorBalance,
  PRODUCT_UPLOAD_EARNING_KES,
  requireProductContributor,
} from "@/lib/productContributor";
import { prisma } from "@/lib/prisma";
import { resolveCanonicalProductBrand } from "@/lib/productBrands";
import { getProductTableCapabilities } from "@/lib/productTableCapabilities";
import { z } from "zod";

export const dynamic = "force-dynamic";

const productInput = z.object({
  name: z.string().trim().min(2).max(255),
  sellingPrice: z.coerce.number().min(0),
  category: z.string().trim().min(2).max(120),
  shopSubcategory: z.string().trim().min(1).max(120),
  productType: z.string().trim().max(120).optional().nullable(),
  brand: z.string().trim().min(1).max(120),
  shortDescription: z.string().trim().min(1).max(3000),
  description: z.string().trim().min(1).max(10000),
  warrantyPeriod: z.string().trim().min(1).max(120),
  tiktokVideoUrl: z.string().trim().url().max(500),
  purchaseLink: z.string().trim().url().max(500).optional().nullable(),
  mainImageUrl: z.string().trim().url().max(500),
  galleryImageUrls: z
    .array(z.string().trim().url().max(500))
    .max(12)
    .optional()
    .default([]),
  availabilityType: z
    .enum(["SHOP", "WAREHOUSE", "ORDER_ON_REQUEST", "OUT_OF_STOCK"]),
  stockQuantity: z.coerce.number().int().min(0).max(100000),
  variableCost: z.boolean().default(false),
  lastBuyingPrice: z.coerce.number().min(0).nullable().optional(),
  requiresInstallation: z.boolean().default(false),
  installationIncluded: z.boolean().default(false),
  transportIncluded: z.boolean().default(false),
  zone1TransportFee: z.coerce.number().int().min(0).default(500),
  zone2TransportFee: z.coerce.number().int().min(0).default(750),
  zone3TransportFee: z.coerce.number().int().min(0).default(1000),
});

type ProductInput = z.infer<typeof productInput>;

function skuBase(name: string) {
  return (
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 68) || "WEBSITE-PRODUCT"
  );
}

async function nextSku(name: string) {
  const base = `CONTRIB-${skuBase(name)}`.slice(0, 80);
  let sku = base;
  let index = 2;
  while (
    await prisma.product.findUnique({ where: { sku }, select: { id: true } })
  ) {
    sku = `${base.slice(0, 75)}-${index++}`;
  }
  return sku;
}

function productData(data: ProductInput, sku: string) {
  const websiteVisible = Boolean(data.mainImageUrl);
  const accessoriesIncluded = data.requiresInstallation && data.installationIncluded;
  return {
    sku,
    name: data.name,
    category: data.category,
    sellingPrice: data.sellingPrice,
    brand: data.brand || null,
    shortDescription: data.shortDescription || null,
    description: data.description || null,
    specifications: [],
    warrantyPeriod: data.warrantyPeriod || null,
    warrantyNotes: null,
    tiktokVideoUrl: data.tiktokVideoUrl || null,
    purchaseLink: data.purchaseLink || null,
    mainImageUrl: data.mainImageUrl,
    shopImageUrl: data.mainImageUrl,
    galleryImageUrls: data.galleryImageUrls,
    showInShop: websiteVisible,
    ecommerceVisible: websiteVisible,
    shopCategory: data.category,
    shopSubcategory: data.shopSubcategory || null,
    productType: data.productType || null,
    shopShortDescription: data.shortDescription || null,
    shopWarranty: data.warrantyPeriod || null,
    shopSpecs: null,
    shopBrand: data.brand || null,
    availabilityType: data.availabilityType,
    variableCost: data.variableCost,
    lastBuyingPrice: data.variableCost ? null : (data.lastBuyingPrice ?? null),
    pickupDelayDays: data.availabilityType === "WAREHOUSE" ? 1 : 0,
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
      accessoriesMode: accessoriesIncluded ? "INCLUDED" : "NOT_INCLUDED",
      preliminaryAccessoriesFee: null,
      includedAccessories: accessoriesIncluded
        ? "Installation accessories included in the advertised package."
        : "",
      installationNotes: "",
      transportMode: data.transportIncluded ? "INCLUDED" : "ZONE",
      useDefaultTransportRates: false,
      zone1TransportFee: data.zone1TransportFee,
      zone2TransportFee: data.zone2TransportFee,
      zone3TransportFee: data.zone3TransportFee,
      priceIncludes: [
        "EQUIPMENT",
        ...(data.installationIncluded ? ["INSTALLATION"] : []),
        ...(accessoriesIncluded
          ? ["ACCESSORIES", "COMMISSIONING", "REMOTE_SUPPORT"]
          : []),
        ...(data.transportIncluded ? ["TRANSPORT"] : []),
      ],
      allInclusive: false,
      allInclusiveItems: [],
      structuredSpecifications: [],
      componentWarranties: [],
      projectImageUrls: [],
      requiresSiteAssessment: false,
    },
  };
}

export async function GET() {
  const access = await requireProductContributor();
  if (!access.ok) return access.res;
  const [balance, products, withdrawals] = await Promise.all([
    getContributorBalance(access.userId),
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT p."id", p."sku", p."name", p."sellingPrice", p."category", p."shopSubcategory", p."productType", p."brand", p."shortDescription", p."description", p."warrantyPeriod", p."warrantyNotes", p."tiktokVideoUrl", p."purchaseLink", p."mainImageUrl", p."galleryImageUrls", p."availabilityType", p."stockQuantity", p."variableCost", p."lastBuyingPrice", p."catalogueConfiguration", p."showInShop", p."ecommerceVisible", p."updatedAt", cpp."earningKes"
       FROM "ProductContributorProduct" cpp
       JOIN "Product" p ON p."id" = cpp."productId"
       WHERE cpp."contributorId" = $1
       ORDER BY cpp."createdAt" DESC`,
      access.userId,
    ),
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "id", "amountKes", "status", "paymentReference", "adminNote", "requestedAt", "processedAt"
       FROM "ProductContributorWithdrawal" WHERE "contributorId" = $1 ORDER BY "requestedAt" DESC`,
      access.userId,
    ),
  ]);
  return noStoreJson({
    ok: true,
    earningPerProductKes: PRODUCT_UPLOAD_EARNING_KES,
    balance,
    products,
    withdrawals,
  });
}

export async function POST(req: Request) {
  const access = await requireProductContributor();
  if (!access.ok) return access.res;
  const parsed = productInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  const sku = await nextSku(parsed.data.name);
  const brand = await resolveCanonicalProductBrand(
    prisma,
    await getProductTableCapabilities(prisma),
    parsed.data.brand,
  );
  const product = await prisma.product.create({
    data: productData({ ...parsed.data, brand: brand ?? parsed.data.brand }, sku),
  });
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ProductContributorProduct" ("productId", "contributorId", "earningKes") VALUES ($1, $2, $3)`,
    product.id,
    access.userId,
    PRODUCT_UPLOAD_EARNING_KES,
  );
  await prisma.actionLog.create({
    data: {
      actorId: access.userId,
      entity: "Product",
      entityId: product.id,
      action: "CONTRIBUTOR_PRODUCT_CREATE",
      after: product,
    },
  });
  return noStoreJson(
    { ok: true, product, earningKes: PRODUCT_UPLOAD_EARNING_KES },
    { status: 201 },
  );
}
