import type { PrismaClient } from "@prisma/client";
import type { ProductTableCapabilities } from "@/lib/productTableCapabilities";

function normalizeBrandKey(value: string) {
  return value.trim().toLowerCase();
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function dedupeBrands(values: Array<string | null | undefined>) {
  const unique = new Map<string, string>();
  for (const value of values) {
    const normalized = normalizeOptionalText(value);
    if (!normalized) continue;
    const key = normalizeBrandKey(normalized);
    if (!unique.has(key)) unique.set(key, normalized);
  }
  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
}

export async function getDistinctProductBrands(
  prisma: PrismaClient,
  capabilities: ProductTableCapabilities,
  input?: { q?: string | null; limit?: number | null },
) {
  const selectParts: string[] = [];
  if (capabilities.brand) {
    selectParts.push(`SELECT "brand" AS value FROM "Product" WHERE "brand" IS NOT NULL AND BTRIM("brand") <> ''`);
  }
  if (capabilities.shopBrand) {
    selectParts.push(`SELECT "shopBrand" AS value FROM "Product" WHERE "shopBrand" IS NOT NULL AND BTRIM("shopBrand") <> ''`);
  }

  if (!selectParts.length) return [] as string[];

  const rows = await prisma.$queryRawUnsafe<Array<{ value: string | null }>>(selectParts.join(" UNION ALL "));
  const deduped = dedupeBrands(rows.map((row) => row.value));
  const query = String(input?.q || "").trim().toLowerCase();
  const filtered = query ? deduped.filter((brand) => brand.toLowerCase().includes(query)) : deduped;
  const limit = Math.max(1, Math.min(Number(input?.limit || 12), 100));
  return filtered.slice(0, limit);
}

export async function resolveCanonicalProductBrand(
  prisma: PrismaClient,
  capabilities: ProductTableCapabilities,
  rawBrand: string | null | undefined,
) {
  const normalized = normalizeOptionalText(rawBrand);
  if (!normalized) return null;

  const matches = await getDistinctProductBrands(prisma, capabilities, { q: normalized, limit: 100 });
  const direct = matches.find((brand) => normalizeBrandKey(brand) === normalizeBrandKey(normalized));
  return direct ?? normalized;
}
