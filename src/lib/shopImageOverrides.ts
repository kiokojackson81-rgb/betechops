import { prisma } from "@/lib/prisma";
import { SHOP_CATEGORY_DEFINITIONS } from "@/app/shop/shopCatalogConfig";

const SHOP_IMAGE_OVERRIDES_KEY = "shop_image_overrides";

type RawOverrides = {
  heroBannerUrl?: unknown;
  categoryImages?: unknown;
};

export type ShopImageOverrides = {
  heroBannerUrl: string | null;
  categoryImages: Record<string, string>;
};

export type ShopImageSlot = {
  kind: "hero" | "category";
  key: string;
  label: string;
  currentUrl: string;
  defaultUrl: string;
};

function normalizeUrl(value: unknown) {
  const url = String(value ?? "").trim();
  return url.length ? url : null;
}

function normalizeCategoryImages(value: unknown) {
  if (!value || typeof value !== "object") return {} as Record<string, string>;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, raw]) => [String(key), normalizeUrl(raw)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

export async function getShopImageOverrides(): Promise<ShopImageOverrides> {
  const row = await prisma.config.findUnique({ where: { key: SHOP_IMAGE_OVERRIDES_KEY } });
  const json = ((row?.json as RawOverrides | null) ?? {}) as RawOverrides;

  return {
    heroBannerUrl: normalizeUrl(json.heroBannerUrl),
    categoryImages: normalizeCategoryImages(json.categoryImages),
  };
}

export async function saveShopImageOverrides(next: ShopImageOverrides) {
  return prisma.config.upsert({
    where: { key: SHOP_IMAGE_OVERRIDES_KEY },
    update: {
      json: {
        heroBannerUrl: next.heroBannerUrl,
        categoryImages: next.categoryImages,
      },
    },
    create: {
      key: SHOP_IMAGE_OVERRIDES_KEY,
      json: {
        heroBannerUrl: next.heroBannerUrl,
        categoryImages: next.categoryImages,
      },
    },
  });
}

export async function getShopImageSlots(): Promise<ShopImageSlot[]> {
  const overrides = await getShopImageOverrides();
  const heroDefault = "/agents/hero-generated-v2.png";

  return [
    {
      kind: "hero",
      key: "hero-banner",
      label: "Home hero banner",
      currentUrl: overrides.heroBannerUrl ?? heroDefault,
      defaultUrl: heroDefault,
    },
    ...SHOP_CATEGORY_DEFINITIONS.map((category) => ({
      kind: "category" as const,
      key: category.value,
      label: category.label,
      currentUrl: overrides.categoryImages[category.value] ?? category.image,
      defaultUrl: category.image,
    })),
  ];
}
