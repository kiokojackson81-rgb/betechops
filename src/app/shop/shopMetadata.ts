import type { Metadata } from "next";
import type { ShopProduct } from "@/app/shop/shopData";

const defaultTitle = "Betech Solar Online Store";
const defaultDescription =
  "Shop genuine solar panels, inverters, batteries, lithium batteries, full solar kits, water pumps, lights and accessories from Betech Solar Solutions. Delivery countrywide.";

export function buildShopMetadata(input?: {
  title?: string;
  description?: string;
  robots?: Metadata["robots"];
  alternates?: Metadata["alternates"];
}): Metadata {
  return {
    title: input?.title ? `${input.title} | ${defaultTitle}` : `${defaultTitle} | Solar Panels, Batteries, Inverters & Kits`,
    description: input?.description || defaultDescription,
    robots: input?.robots,
    alternates: input?.alternates,
  };
}

export function buildProductJsonLd(product: ShopProduct) {
  const availabilityMap = {
    in_stock: "https://schema.org/InStock",
    limited_stock: "https://schema.org/LimitedAvailability",
    preorder: "https://schema.org/PreOrder",
    quote_only: "https://schema.org/PreOrder",
  } as const;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    brand: {
      "@type": "Brand",
      name: product.brand,
    },
    category: product.category,
    description: `${product.specs.join(". ")}. ${product.warranty}. Genuine Betech Solar product details and delivery support.`,
    offers: {
      "@type": "Offer",
      priceCurrency: "KES",
      price: product.price,
      availability: availabilityMap[product.stockStatus],
      itemCondition: "https://schema.org/NewCondition",
    },
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Warranty",
        value: product.warranty,
      },
      {
        "@type": "PropertyValue",
        name: "Spec summary",
        value: product.specs.join(" | "),
      },
    ],
  };
}
