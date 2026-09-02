import { noStoreJson } from "@/lib/api";
import {
  getContributorBalance,
  PRODUCT_UPLOAD_EARNING_KES,
  requireProductContributor,
} from "@/lib/productContributor";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const productInput = z.object({
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

type ProductInput = z.infer<typeof productInput>;

function skuBase(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 68) || "WEBSITE-PRODUCT";
}

async function nextSku(name: string) {
  const base = `CONTRIB-${skuBase(name)}`.slice(0, 80);
  let sku = base;
  let index = 2;
  while (await prisma.product.findUnique({ where: { sku }, select: { id: true } })) {
    sku = `${base.slice(0, 75)}-${index++}`;
  }
  return sku;
}

function productData(data: ProductInput, sku: string) {
  const websiteVisible = Boolean(data.mainImageUrl);
  return {
    sku,
    name: data.name,
    category: data.category,
    sellingPrice: data.sellingPrice,
    brand: data.brand || null,
    shortDescription: data.shortDescription || null,
    description: data.description || null,
    specifications: data.specifications,
    warrantyPeriod: data.warrantyPeriod || null,
    warrantyNotes: data.warrantyNotes || null,
    mainImageUrl: data.mainImageUrl,
    shopImageUrl: data.mainImageUrl,
    galleryImageUrls: data.galleryImageUrls,
    showInShop: websiteVisible,
    ecommerceVisible: websiteVisible,
    shopCategory: data.category,
    shopShortDescription: data.shortDescription || null,
    shopWarranty: data.warrantyPeriod || null,
    shopSpecs: data.specifications.join(", ") || null,
    shopBrand: data.brand || null,
    availabilityType: data.availabilityType,
    pickupDelayDays: data.availabilityType === "WAREHOUSE" ? 1 : 0,
    stockQuantity: data.stockQuantity,
    isActive: true,
    status: "ACTIVE",
    posEnabled: true,
  };
}

export async function GET() {
  const access = await requireProductContributor();
  if (!access.ok) return access.res;
  const [balance, products, withdrawals] = await Promise.all([
    getContributorBalance(access.userId),
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT p."id", p."sku", p."name", p."sellingPrice", p."category", p."brand", p."shortDescription", p."description", p."specifications", p."warrantyPeriod", p."warrantyNotes", p."mainImageUrl", p."galleryImageUrls", p."availabilityType", p."stockQuantity", p."showInShop", p."ecommerceVisible", p."updatedAt", cpp."earningKes"
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
  return noStoreJson({ ok: true, earningPerProductKes: PRODUCT_UPLOAD_EARNING_KES, balance, products, withdrawals });
}

export async function POST(req: Request) {
  const access = await requireProductContributor();
  if (!access.ok) return access.res;
  const parsed = productInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  const sku = await nextSku(parsed.data.name);
  const product = await prisma.product.create({ data: productData(parsed.data, sku) });
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ProductContributorProduct" ("productId", "contributorId", "earningKes") VALUES ($1, $2, $3)`,
    product.id,
    access.userId,
    PRODUCT_UPLOAD_EARNING_KES,
  );
  await prisma.actionLog.create({
    data: { actorId: access.userId, entity: "Product", entityId: product.id, action: "CONTRIBUTOR_PRODUCT_CREATE", after: product },
  });
  return noStoreJson({ ok: true, product, earningKes: PRODUCT_UPLOAD_EARNING_KES }, { status: 201 });
}
