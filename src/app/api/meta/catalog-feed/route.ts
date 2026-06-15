import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const FEED_URL_BASE = "https://betech.co.ke";
const CSV_HEADERS = [
  "id",
  "title",
  "description",
  "availability",
  "quantity_to_sell_on_facebook",
  "condition",
  "price",
  "link",
  "image_link",
  "brand",
] as const;

type CatalogFeedProduct = {
  id: string;
  name: string;
  description: string | null;
  sellingPrice: number;
  stockQuantity: number;
  mainImageUrl: string | null;
  shopImageUrl: string | null;
};

function slugifyProductName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeCsvValue(value: unknown) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function productsToCatalogCsv(products: CatalogFeedProduct[]) {
  const rows = products.map((product) => {
    const link = `${FEED_URL_BASE}/products/${slugifyProductName(product.name)}`;
    const imageLink = product.mainImageUrl || product.shopImageUrl || "";
    const availability = "in stock";

    return [
      product.id,
      product.name,
      product.description ?? "",
      availability,
      100,
      "new",
      `${Number(product.sellingPrice).toFixed(2)} KES`,
      link,
      imageLink,
      "Betech Solar",
    ]
      .map(escapeCsvValue)
      .join(",");
  });

  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        status: "ACTIVE",
        ecommerceVisible: true,
        showInShop: true,
        OR: [{ mainImageUrl: { not: null } }, { shopImageUrl: { not: null } }],
      },
      select: {
        id: true,
        name: true,
        description: true,
        sellingPrice: true,
        stockQuantity: true,
        mainImageUrl: true,
        shopImageUrl: true,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    const csv = productsToCatalogCsv(products);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[meta-catalog-feed] failed to generate feed", error);

    return new NextResponse("Failed to generate catalog feed", {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
