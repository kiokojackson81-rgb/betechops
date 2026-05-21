import type { PrismaClient } from "@prisma/client";

export type ProductTableCapabilities = {
  available: Set<string>;
  schemaMode: "modern" | "legacy";
  showInShop: boolean;
  shopCategory: boolean;
  shopShortDescription: boolean;
  shopWarranty: boolean;
  shopSpecs: boolean;
  shopImageUrl: boolean;
  shopBrand: boolean;
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
    shopShortDescription: available.has("shopShortDescription"),
    shopWarranty: available.has("shopWarranty"),
    shopSpecs: available.has("shopSpecs"),
    shopImageUrl: available.has("shopImageUrl"),
    shopBrand: available.has("shopBrand"),
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
