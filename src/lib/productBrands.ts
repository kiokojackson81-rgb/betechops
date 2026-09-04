import type { PrismaClient } from "@prisma/client";
import type { ProductTableCapabilities } from "@/lib/productTableCapabilities";

const UPPERCASE_BRAND_TOKENS = new Set(["SRNE", "MUST", "SOK", "UPS", "DC", "AC", "PWM", "MPPT"]);

function collapseBrandWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeBrandKey(value: string) {
  return collapseBrandWhitespace(value).toLowerCase();
}

export function toCanonicalBrandName(value: string | null | undefined) {
  const normalized = collapseBrandWhitespace(String(value || ""));
  if (!normalized) return null;

  return normalized
    .split(" ")
    .map((token) => {
      if (!token) return token;
      const upper = token.toUpperCase();
      if (UPPERCASE_BRAND_TOKENS.has(upper)) return upper;
      if (/^[A-Z0-9-]{2,6}$/.test(token)) return upper;
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ");
}

function normalizeOptionalText(value: string | null | undefined) {
  return toCanonicalBrandName(value);
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

async function listDistinctProductBrands(
  prisma: PrismaClient,
  capabilities: ProductTableCapabilities,
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
  return dedupeBrands(rows.map((row) => row.value));
}

export async function getDistinctProductBrands(
  prisma: PrismaClient,
  capabilities: ProductTableCapabilities,
  input?: { q?: string | null; limit?: number | null },
) {
  const deduped = await listDistinctProductBrands(prisma, capabilities);
  const query = String(input?.q || "").trim().toLowerCase();
  const filtered = query ? deduped.filter((brand) => brand.toLowerCase().includes(query)) : deduped;
  const limit = Math.max(1, Math.min(Number(input?.limit || 12), 100));
  return filtered.slice(0, limit);
}

export async function findProductBrandMention(
  prisma: PrismaClient,
  capabilities: ProductTableCapabilities,
  title: string | null | undefined,
) {
  const normalizedTitle = String(title || "").trim().toLowerCase();
  if (!normalizedTitle) return null;

  const brands = await listDistinctProductBrands(prisma, capabilities);
  return (
    brands
      .sort((a, b) => b.length - a.length)
      .find((brand) => {
        const escaped = brand
          .trim()
          .toLowerCase()
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(
          normalizedTitle,
        );
      }) ?? null
  );
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
