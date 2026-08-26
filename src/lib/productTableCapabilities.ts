import type { PrismaClient } from "@prisma/client";

export type ProductTableCapabilities = {
  available: Set<string>;
  schemaMode: "modern" | "legacy";
  showInShop: boolean;
  shopCategory: boolean;
  shopSubcategory: boolean;
  shopShortDescription: boolean;
  shopWarranty: boolean;
  shopSpecs: boolean;
  shopImageUrl: boolean;
  shopBrand: boolean;
  brand: boolean;
  shortDescription: boolean;
  description: boolean;
  specifications: boolean;
  warrantyPeriod: boolean;
  warrantyNotes: boolean;
  mainImageUrl: boolean;
  imageExtractedText: boolean;
  galleryImageUrls: boolean;
  brandImageUrl: boolean;
  tiktokVideoUrl: boolean;
  ecommerceVisible: boolean;
  isFeatured: boolean;
  status: boolean;
  availabilityType: boolean;
  pickupDelayDays: boolean;
  productType: boolean;
  posEnabled: boolean;
  catalogueConfiguration: boolean;
  defaultWarranty: boolean;
  modernPricing: boolean;
  legacyPricing: boolean;
  skuColumn: string;
  nameColumn: string;
  categoryColumn: string;
  priceColumn: string;
  activeColumn: string;
};

export async function getProductTableCapabilities(prisma: PrismaClient): Promise<ProductTableCapabilities> {
  const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Product' ORDER BY ordinal_position`,
  );
  const available = new Set(columns.map((entry) => entry.column_name));
  const modern = available.has("sku");

  return {
    available,
    schemaMode: modern ? "modern" : "legacy",
    showInShop: available.has("showInShop"),
    shopCategory: available.has("shopCategory"),
    shopSubcategory: available.has("shopSubcategory"),
    shopShortDescription: available.has("shopShortDescription"),
    shopWarranty: available.has("shopWarranty"),
    shopSpecs: available.has("shopSpecs"),
    shopImageUrl: available.has("shopImageUrl"),
    shopBrand: available.has("shopBrand"),
    brand: available.has("brand"),
    shortDescription: available.has("shortDescription"),
    description: available.has("description"),
    specifications: available.has("specifications"),
    warrantyPeriod: available.has("warrantyPeriod"),
    warrantyNotes: available.has("warrantyNotes"),
    mainImageUrl: available.has("mainImageUrl"),
    imageExtractedText: available.has("imageExtractedText"),
    galleryImageUrls: available.has("galleryImageUrls"),
    brandImageUrl: available.has("brandImageUrl"),
    tiktokVideoUrl: available.has("tiktokVideoUrl"),
    ecommerceVisible: available.has("ecommerceVisible"),
    isFeatured: available.has("isFeatured"),
    status: available.has("status"),
    availabilityType: available.has("availabilityType"),
    pickupDelayDays: available.has("pickupDelayDays"),
    productType: available.has("productType"),
    posEnabled: available.has("posEnabled"),
    catalogueConfiguration: available.has("catalogueConfiguration"),
    defaultWarranty: available.has("defaultWarranty"),
    modernPricing: available.has("sellingPrice"),
    legacyPricing: available.has("sellPrice"),
    skuColumn: modern ? "sku" : "key",
    nameColumn: "name",
    categoryColumn: modern ? "category" : "unit",
    priceColumn: modern ? "sellingPrice" : "sellPrice",
    activeColumn: modern ? "isActive" : "active",
  };
}
