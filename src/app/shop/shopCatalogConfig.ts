import type { ShopProductVisualType } from "@/app/shop/shopData";

type ShopAccent = "gold" | "maroon" | "green";

export type ShopSubcategoryDefinition = {
  value: string;
  label: string;
  keywords: string[];
};

export type ShopCategoryDefinition = {
  value: string;
  label: string;
  blurb: string;
  image: string;
  accent: ShopAccent;
  visualType: ShopProductVisualType;
  keywords: string[];
  subcategories: ShopSubcategoryDefinition[];
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeSubcategories(labels: string[], extraKeywords: Record<string, string[]> = {}) {
  return labels.map((label) => ({
    value: slugify(label),
    label,
    keywords: [label, ...label.split(/\s+/), ...(extraKeywords[label] || [])].map((item) => item.toLowerCase()),
  }));
}

export const SHOP_CATEGORY_DEFINITIONS: ShopCategoryDefinition[] = [
  {
    value: "solar-full-kits",
    label: "Solar Full Kits",
    blurb: "Ready-built kits for home backup, biashara systems and complete solar setups.",
    image: "/agents/category-solar-full-kits.png",
    accent: "maroon",
    visualType: "kit",
    keywords: ["solar full kit", "solar kit", "complete home system", "all in one", "starter solar kit", "heavy duty solar system"],
    subcategories: makeSubcategories(
      [
        "Lithium Solar Kits",
        "Gel Solar Kits",
        "Home Backup Kits",
        "Biashara Solar Kits",
        "CCTV Solar Kits",
        "Water Pump Solar Kits",
        "Complete Home Systems",
        "All-In-One Solar Systems",
        "Starter Solar Kits",
        "Heavy Duty Solar Systems",
      ],
      {
        "Biashara Solar Kits": ["business solar kit", "shop solar kit"],
        "CCTV Solar Kits": ["camera solar kit", "security solar kit"],
      },
    ),
  },
  {
    value: "solar-panels",
    label: "Solar Panels",
    blurb: "High-output panels for rooftops, farms, institutions and backup systems.",
    image: "/agents/product-solar-kit-generated.png",
    accent: "gold",
    visualType: "panel",
    keywords: ["solar panel", "585w panel", "620w panel", "tier 1 panel", "portable panel"],
    subcategories: makeSubcategories([
      "Monocrystalline Panels",
      "Polycrystalline Panels",
      "Bifacial Solar Panels",
      "Monofacial Solar Panels",
      "Flexible Solar Panels",
      "Portable Solar Panels",
      "Half-Cut Panels",
      "Tier 1 Solar Panels",
    ]),
  },
  {
    value: "solar-batteries",
    label: "Solar Batteries",
    blurb: "Gel, lithium and deep-cycle storage options for backup and daily use.",
    image: "/agents/product-battery-generated.png",
    accent: "green",
    visualType: "battery",
    keywords: ["solar battery", "100ah battery", "200ah battery", "deep cycle battery", "rack mount battery", "wall mount battery"],
    subcategories: makeSubcategories(
      [
        "Lithium Batteries",
        "Gel Batteries",
        "AGM Batteries",
        "Tubular Batteries",
        "Lead Acid Batteries",
        "Deep Cycle Batteries",
        "Rack Mount Batteries",
        "Wall Mount Batteries",
      ],
      {
        "Lithium Batteries": ["lifepo4 battery"],
      },
    ),
  },
  {
    value: "solar-inverters",
    label: "Solar Inverters",
    blurb: "Hybrid, off-grid and commercial inverter options for Kenyan solar systems.",
    image: "/agents/product-inverter-generated.png",
    accent: "maroon",
    visualType: "inverter",
    keywords: ["solar inverter", "hybrid inverter", "5kva inverter", "3.5kw inverter", "pumping inverter", "three phase inverter"],
    subcategories: makeSubcategories(
      [
        "Hybrid Inverters",
        "Non-Hybrid Inverters",
        "Pure Sine Wave Inverters",
        "Charger Inverters",
        "On-Grid Inverters",
        "Off-Grid Inverters",
        "Low Frequency Inverters",
        "High Frequency Inverters",
        "Pumping Inverters",
        "Three Phase Inverters",
      ],
      {
        "Pure Sine Wave Inverters": ["pure sine inverter"],
        "Three Phase Inverters": ["3 phase inverter"],
      },
    ),
  },
  {
    value: "solar-water-pumps",
    label: "Solar Water Pumps",
    blurb: "Water pumping solutions for boreholes, shallow wells, livestock and irrigation.",
    image: "/agents/product-water-pump-generated.png",
    accent: "green",
    visualType: "pump",
    keywords: ["solar pump", "borehole pump", "water pump", "surface pump", "submersible pump", "petrol water pump"],
    subcategories: makeSubcategories([
      "DC Solar Water Pumps",
      "AC Solar Water Pumps",
      "Submersible Pumps",
      "Surface Pumps",
      "Borehole Pumps",
      "Shallow Well Pumps",
      "Deep Well Pumps",
      "Booster Pumps",
      "Irrigation Pumps",
      "Livestock Water Pumps",
      "Hybrid Water Pumps",
      "Solar Pump Kits",
      "Pump Controllers",
      "Pumping Inverters",
      "Petrol Water Pumps",
    ]),
  },
  {
    value: "solar-lights",
    label: "Solar Lights",
    blurb: "Security, street and compound lighting for homes, shops and institutions.",
    image: "/agents/hero-generated-v2.png",
    accent: "gold",
    visualType: "light",
    keywords: ["solar light", "street light", "flood light", "motion sensor light", "garden light"],
    subcategories: makeSubcategories([
      "Solar Street Lights",
      "Solar Flood Lights",
      "Solar Wall Lights",
      "Solar Garden Lights",
      "Solar Motion Sensor Lights",
      "Solar Ceiling Lights",
      "Solar Indoor Lights",
      "Solar Security Lights",
      "Solar Camping Lights",
    ]),
  },
  {
    value: "solar-cameras-security",
    label: "Solar Cameras & Security",
    blurb: "Solar CCTV, security kits and remote surveillance solutions.",
    image: "/agents/top-agents-card.png",
    accent: "green",
    visualType: "light",
    keywords: ["solar camera", "solar cctv", "4g camera", "wifi camera", "nvr kit", "security kit"],
    subcategories: makeSubcategories([
      "Solar CCTV Cameras",
      "4G Solar Cameras",
      "WiFi Solar Cameras",
      "PTZ Solar Cameras",
      "Solar Security Kits",
      "NVR Kits",
      "CCTV Accessories",
    ]),
  },
  {
    value: "dc-appliances",
    label: "DC Appliances",
    blurb: "Efficient DC electronics for direct solar use and lightweight backup setups.",
    image: "/agents/product-accessories-generated.png",
    accent: "maroon",
    visualType: "light",
    keywords: [
      "dc tv",
      "dc woofer",
      "dc fridge",
      "dc fan",
      "dc freezer",
      "dc bulb",
      "dc air cooler",
      "solar incubator",
      "egg incubator",
      "poultry incubator",
    ],
    subcategories: [
      ...makeSubcategories([
        "DC TVs",
        "DC Woofers",
        "DC Fridges",
        "DC Fans",
        "DC Freezers",
        "DC Bulbs",
        "DC Air Coolers",
      ]),
      {
        value: "solar-incubators",
        label: "DC Solar Incubator",
        keywords: ["dc solar incubator", "solar incubator", "egg incubator", "poultry incubator", "automatic incubator"],
      },
    ],
  },
  {
    value: "solar-water-heaters",
    label: "Solar Water Heaters",
    blurb: "Domestic and commercial hot water systems for homes, rentals and hospitality.",
    image: "/agents/cta-house-generated.png",
    accent: "gold",
    visualType: "heater",
    keywords: ["solar water heater", "pressurized water heater", "vacuum tube heater", "flat plate heater"],
    subcategories: makeSubcategories([
      "Pressurized Water Heaters",
      "Non-Pressurized Water Heaters",
      "Flat Plate Water Heaters",
      "Vacuum Tube Water Heaters",
      "Integrated Systems",
      "Split Systems",
      "Commercial Water Heaters",
    ]),
  },
  {
    value: "solar-charge-controllers",
    label: "Solar Charge Controllers",
    blurb: "PWM and MPPT charge controllers for starter, lithium and higher-voltage systems.",
    image: "/agents/product-accessories-generated.png",
    accent: "maroon",
    visualType: "inverter",
    keywords: ["charge controller", "mppt", "pwm", "bluetooth controller", "high voltage mppt"],
    subcategories: makeSubcategories([
      "PWM Controllers",
      "MPPT Controllers",
      "Bluetooth Controllers",
      "LCD Controllers",
      "High Voltage MPPTs",
    ]),
  },
  {
    value: "solar-accessories",
    label: "Solar Accessories",
    blurb: "Connectors, cables, breakers and installation items for cleaner solar builds.",
    image: "/agents/product-accessories-generated.png",
    accent: "maroon",
    visualType: "kit",
    keywords: ["mc4", "solar cable", "battery cable", "changeover switch", "breaker", "dc bulb", "solar fan", "connector"],
    subcategories: makeSubcategories([
      "MC4 Connectors",
      "Solar Cables",
      "Battery Cables",
      "Changeover Switches",
      "Breakers",
      "AVS Protectors",
      "Surge Protectors",
      "Fuse Holders",
      "Distribution Boxes",
      "Mounting Structures",
      "Cable Clips",
      "DC Bulbs",
      "Solar Fans",
    ]),
  },
  {
    value: "portable-power-stations",
    label: "Portable Power Stations",
    blurb: "Portable lithium and gel backup units for camping, travel and emergency power.",
    image: "/agents/product-battery-generated.png",
    accent: "green",
    visualType: "battery",
    keywords: ["portable power station", "portable solar generator", "camping power station", "backup power station"],
    subcategories: makeSubcategories([
      "Lithium Power Stations",
      "Gel Power Stations",
      "Camping Power Stations",
      "Backup Power Stations",
      "Portable Solar Generators",
    ]),
  },
  {
    value: "commercial-industrial-solar",
    label: "Commercial & Industrial Solar",
    blurb: "Larger-scale solar systems, industrial batteries and commercial inverter solutions.",
    image: "/agents/product-inverter-generated.png",
    accent: "maroon",
    visualType: "inverter",
    keywords: ["commercial solar", "industrial solar", "three phase system", "high voltage system", "commercial inverter"],
    subcategories: makeSubcategories([
      "Commercial Solar Systems",
      "Three Phase Systems",
      "Industrial Batteries",
      "High Voltage Systems",
      "Commercial Inverters",
    ]),
  },
];

export const SHOP_CATEGORY_OPTIONS: Array<{ value: ShopCategoryDefinition["value"]; label: ShopCategoryDefinition["label"] }> =
  SHOP_CATEGORY_DEFINITIONS.map((category) => ({
    value: category.value,
    label: category.label,
  }));

export const SHOP_SUBCATEGORY_OPTIONS = SHOP_CATEGORY_DEFINITIONS.flatMap((category) =>
  category.subcategories.map((subcategory) => ({
    category: category.value,
    value: subcategory.value,
    label: subcategory.label,
  })),
);

export const SHOP_SEARCH_ALIASES = [
  { query: "200ah battery", keywords: ["200ah", "battery", "gel battery", "lithium battery"] },
  { query: "100ah battery", keywords: ["100ah", "battery", "gel battery", "lithium battery"] },
  { query: "5kva inverter", keywords: ["5kva inverter", "5kw inverter", "hybrid inverter"] },
  { query: "3.5kw inverter", keywords: ["3.5kw inverter", "hybrid inverter"] },
  { query: "585w panel", keywords: ["585w panel", "solar panel"] },
  { query: "620w panel", keywords: ["620w panel", "solar panel"] },
  { query: "solar pump", keywords: ["solar pump", "water pump"] },
  { query: "borehole pump", keywords: ["borehole pump", "submersible pump", "water pump"] },
  { query: "street light", keywords: ["street light", "solar light"] },
  { query: "flood light", keywords: ["flood light", "solar light"] },
  { query: "dc tv", keywords: ["dc tv", "dc appliances"] },
  { query: "charge controller", keywords: ["charge controller", "mppt", "pwm"] },
  { query: "mppt", keywords: ["mppt", "charge controller"] },
  { query: "pwm", keywords: ["pwm", "charge controller"] },
] as const;

export type ShopCategoryOptionValue = (typeof SHOP_CATEGORY_OPTIONS)[number]["value"];
export type ShopSubcategoryOptionValue = (typeof SHOP_SUBCATEGORY_OPTIONS)[number]["value"];

export function normalizeShopCategorySlug(value: string | null | undefined) {
  return slugify(String(value || ""));
}

export function getShopCategoryDefinition(value: string | null | undefined) {
  const slug = normalizeShopCategorySlug(value);
  return SHOP_CATEGORY_DEFINITIONS.find((category) => category.value === slug) ?? null;
}

export function getShopSubcategoryOptions(categoryValue: string | null | undefined) {
  return getShopCategoryDefinition(categoryValue)?.subcategories ?? [];
}

export function getShopSubcategoryDefinition(categoryValue: string | null | undefined, subcategoryValue: string | null | undefined) {
  const subcategorySlug = normalizeShopCategorySlug(subcategoryValue);
  return getShopSubcategoryOptions(categoryValue).find((subcategory) => subcategory.value === subcategorySlug) ?? null;
}

export function resolveShopSubcategory(
  categoryValue: string | null | undefined,
  values: Array<string | null | undefined>,
) {
  const normalizedHaystack = values
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");

  return (
    getShopSubcategoryOptions(categoryValue).find((subcategory) =>
      subcategory.keywords.some((keyword) => normalizedHaystack.includes(keyword.toLowerCase())),
    ) ?? null
  );
}

export function expandShopSearchQuery(query: string | null | undefined) {
  const normalized = String(query || "").trim().toLowerCase();
  const alias = SHOP_SEARCH_ALIASES.find((item) => item.query === normalized);
  if (!normalized) return [];
  return Array.from(new Set([normalized, ...(alias?.keywords || [])]));
}
