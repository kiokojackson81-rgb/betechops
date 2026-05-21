export type ShopCategory = {
  slug: string;
  title: string;
  blurb: string;
  image: string;
  accent: "gold" | "maroon" | "green";
};

export type ShopProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  oldPrice?: number;
  image: string;
  specs: string[];
  warranty: string;
  stockStatus: "in_stock" | "limited_stock" | "preorder" | "quote_only";
  tags: string[];
  source: "mock";
  opsProductId: null;
};

export type ShopProductSection = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  products: ShopProduct[];
};

export const shopNavLinks = [
  { label: "Solar Panels", href: "#solar-panels" },
  { label: "Inverters", href: "#hybrid-inverters" },
  { label: "Batteries", href: "#lithium-batteries" },
  { label: "Full Kits", href: "#best-selling-solar-kits" },
  { label: "Pumps", href: "#water-pumps" },
  { label: "Request Quote", href: "#quote" },
];

export const shopCategories: ShopCategory[] = [
  {
    slug: "solar-panels",
    title: "Solar Panels",
    blurb: "Panels for homes, biashara, farms, and backup power installs.",
    image: "/agents/product-solar-kit-clean.png",
    accent: "gold",
  },
  {
    slug: "solar-inverters",
    title: "Solar Inverters",
    blurb: "Hybrid and pure sine wave inverter options for stable power.",
    image: "/agents/product-inverter-clean.png",
    accent: "maroon",
  },
  {
    slug: "solar-batteries",
    title: "Solar Batteries",
    blurb: "Reliable backup storage for everyday home and business use.",
    image: "/agents/product-battery-clean.png",
    accent: "green",
  },
  {
    slug: "lithium-batteries",
    title: "Lithium Batteries",
    blurb: "Long-cycle lithium storage for modern solar systems.",
    image: "/agents/product-battery-clean.png",
    accent: "gold",
  },
  {
    slug: "solar-full-kits",
    title: "Solar Full Kits",
    blurb: "Complete solar solutions for homes, shops, and starter installs.",
    image: "/agents/product-solar-kit-clean.png",
    accent: "maroon",
  },
  {
    slug: "all-in-one-systems",
    title: "All-in-One Systems",
    blurb: "Integrated inverter and battery systems for clean installation.",
    image: "/agents/product-solar-kit-clean.png",
    accent: "green",
  },
  {
    slug: "solar-water-heaters",
    title: "Solar Water Heaters",
    blurb: "Hot water systems for homes, rentals, and hospitality spaces.",
    image: "/agents/cta-house-generated.png",
    accent: "gold",
  },
  {
    slug: "solar-water-pumps",
    title: "Solar Water Pumps",
    blurb: "Solar pump systems for farms, boreholes, and irrigation needs.",
    image: "/agents/product-water-pump-clean.png",
    accent: "green",
  },
  {
    slug: "solar-lights",
    title: "Solar Lights",
    blurb: "Lighting for compounds, security, and everyday use.",
    image: "/agents/hero-generated-v2.png",
    accent: "gold",
  },
  {
    slug: "accessories",
    title: "Accessories",
    blurb: "Mounting kits, cables, breakers, and solar add-ons.",
    image: "/agents/product-accessories-clean.png",
    accent: "maroon",
  },
  {
    slug: "request-quotation",
    title: "Request a Solar System Quote",
    blurb: "Talk to Betech Solar Solutions for system sizing and guidance.",
    image: "/agents/top-agents-card.png",
    accent: "green",
  },
];

export const trustBadges = [
  {
    title: "Genuine products",
    copy: "Trusted solar brands supplied by Betech Solar Solutions.",
  },
  {
    title: "Warranty support",
    copy: "Product and system support planned to align with ops workflows later.",
  },
  {
    title: "Nairobi CBD shop",
    copy: "Visit Betech Solar Solutions at Pramukh Plaza, Nairobi CBD.",
  },
  {
    title: "Countrywide delivery",
    copy: "Panels, batteries, pumps, and kits delivered across Kenya.",
  },
  {
    title: "Expert solar guidance",
    copy: "Request sizing help on WhatsApp before placing the final order flow.",
  },
];

export const heroHighlights = [
  {
    label: "Official Betech store",
    value: "Betech Solar Online Store",
    note: "Built to reflect Betech Solar Solutions, not a generic ecommerce theme.",
  },
  {
    label: "Delivered countrywide",
    value: "Panels to full systems",
    note: "Shop genuine solar products with nationwide delivery and WhatsApp support.",
  },
  {
    label: "Request quote fast",
    value: "Sizing help available",
    note: "Talk to the Betech Solar team for home, biashara, and farm system recommendations.",
  },
];

function product(input: Omit<ShopProduct, "source" | "opsProductId">): ShopProduct {
  return {
    ...input,
    source: "mock",
    opsProductId: null,
  };
}

export const shopProductSections: ShopProductSection[] = [
  {
    slug: "best-selling-solar-kits",
    title: "Best Selling Solar Kits",
    eyebrow: "Popular full solar solutions",
    description: "Starter, backup, and lithium-ready kits from Betech Solar Solutions for homes and biashara.",
    products: [
      product({
        id: "kit-starmax-300w",
        slug: "starmax-300w-full-kit",
        name: "Starmax 300W Full Kit",
        category: "Solar Full Kits",
        brand: "Starmax",
        price: 38999,
        oldPrice: 42000,
        image: "/agents/products/starmax-300w-full-kit.jpeg",
        specs: ["300W panel", "Starter backup kit", "Home lighting and TV use"],
        warranty: "12-month warranty",
        stockStatus: "in_stock",
        tags: ["best-seller", "starter-kit", "home-use"],
      }),
      product({
        id: "kit-starmax-200w",
        slug: "starmax-200w-full-kit",
        name: "Starmax 200W Full Kit",
        category: "Solar Full Kits",
        brand: "Starmax",
        price: 21999,
        oldPrice: 24500,
        image: "/agents/products/starmax-200w-full-kit.jpeg",
        specs: ["200W panel", "Compact backup kit", "Lighting and charging"],
        warranty: "12-month warranty",
        stockStatus: "in_stock",
        tags: ["best-seller", "starter-kit", "compact"],
      }),
      product({
        id: "kit-platinum-2-56",
        slug: "platinum-2-56kw-lithium-solar-kit",
        name: "Platinum 2.56KW Lithium Solar Kit",
        category: "Solar Full Kits",
        brand: "Platinum",
        price: 70000,
        oldPrice: 76000,
        image: "/agents/products/platinum-2-56kw-lithium-solar-kit.jpeg",
        specs: ["2.56KW lithium storage", "Modern home backup", "Expandable setup"],
        warranty: "18-month warranty",
        stockStatus: "limited_stock",
        tags: ["lithium-kit", "premium", "home-backup"],
      }),
      product({
        id: "kit-srne-5kw",
        slug: "srne-5kw-lithium-solar-system",
        name: "SRNE 5KW Lithium Solar System",
        category: "Solar Full Kits",
        brand: "SRNE",
        price: 280000,
        oldPrice: 305000,
        image: "/agents/products/srne-5kw-lithium-solar-system.jpeg",
        specs: ["5KW hybrid system", "Lithium-ready", "Home and biashara backup"],
        warranty: "24-month warranty",
        stockStatus: "limited_stock",
        tags: ["premium", "hybrid-kit", "business-backup"],
      }),
    ],
  },
  {
    slug: "solar-panels",
    title: "Solar Panels",
    eyebrow: "Panels for every install size",
    description: "Panel options for fresh installs, system upgrades, and larger backup requirements.",
    products: [
      product({
        id: "panel-jinko-550w",
        slug: "jinko-550w-mono-panel",
        name: "Jinko 550W Mono Panel",
        category: "Solar Panels",
        brand: "Jinko Solar",
        price: 17500,
        oldPrice: 18900,
        image: "/agents/product-solar-kit-clean.png",
        specs: ["550W mono panel", "High output", "Commercial and residential use"],
        warranty: "25-year performance warranty",
        stockStatus: "in_stock",
        tags: ["panel", "mono", "high-output"],
      }),
      product({
        id: "panel-ja-450w",
        slug: "ja-solar-450w-panel",
        name: "JA Solar 450W Panel",
        category: "Solar Panels",
        brand: "JA Solar",
        price: 12800,
        oldPrice: 13950,
        image: "/agents/product-solar-kit-clean.png",
        specs: ["450W panel", "Reliable home installs", "Clean rooftop fit"],
        warranty: "12-year product warranty",
        stockStatus: "in_stock",
        tags: ["panel", "rooftop", "residential"],
      }),
      product({
        id: "panel-jinko-300w",
        slug: "jinko-300w-panel",
        name: "Jinko 300W Panel",
        category: "Solar Panels",
        brand: "Jinko Solar",
        price: 9200,
        image: "/agents/product-solar-kit-clean.png",
        specs: ["300W panel", "Starter kit use", "Home essentials backup"],
        warranty: "12-year product warranty",
        stockStatus: "in_stock",
        tags: ["panel", "starter", "budget"],
      }),
      product({
        id: "panel-mono-600w",
        slug: "600w-mono-utility-panel",
        name: "600W Mono Utility Panel",
        category: "Solar Panels",
        brand: "Betech Solar Select",
        price: 19800,
        oldPrice: 21400,
        image: "/agents/product-solar-kit-clean.png",
        specs: ["600W utility panel", "Large system installs", "Commercial-ready output"],
        warranty: "25-year performance warranty",
        stockStatus: "quote_only",
        tags: ["panel", "utility", "commercial"],
      }),
    ],
  },
  {
    slug: "lithium-batteries",
    title: "Lithium Batteries",
    eyebrow: "Reliable energy storage",
    description: "Lithium battery options for long-cycle home backup, hybrid systems, and business power continuity.",
    products: [
      product({
        id: "battery-100ah-wall",
        slug: "48v-100ah-wall-mount-lithium-battery",
        name: "48V 100Ah Wall Mount Lithium Battery",
        category: "Lithium Batteries",
        brand: "Betech Solar Select",
        price: 115000,
        oldPrice: 125000,
        image: "/agents/product-battery-clean.png",
        specs: ["48V 100Ah", "Wall mount", "Hybrid inverter compatible"],
        warranty: "24-month warranty",
        stockStatus: "in_stock",
        tags: ["lithium", "wall-mount", "hybrid-ready"],
      }),
      product({
        id: "battery-200ah-rack",
        slug: "48v-200ah-rack-lithium-battery",
        name: "48V 200Ah Rack Lithium Battery",
        category: "Lithium Batteries",
        brand: "Betech Solar Select",
        price: 210000,
        oldPrice: 225000,
        image: "/agents/product-battery-clean.png",
        specs: ["48V 200Ah", "Rack mount", "Longer backup runtime"],
        warranty: "24-month warranty",
        stockStatus: "limited_stock",
        tags: ["lithium", "rack-battery", "backup"],
      }),
      product({
        id: "battery-8kw-kit",
        slug: "8kw-lithium-battery-kit",
        name: "8KW Lithium Battery Kit",
        category: "Lithium Batteries",
        brand: "Betech Solar Select",
        price: 350000,
        oldPrice: 375000,
        image: "/agents/products/8kw-lithium-battery-kit.jpeg",
        specs: ["8KW battery kit", "High capacity storage", "Business and home backup"],
        warranty: "24-month warranty",
        stockStatus: "limited_stock",
        tags: ["lithium-kit", "high-capacity", "premium"],
      }),
      product({
        id: "battery-powerstation",
        slug: "2kw-lithium-powerstation",
        name: "2KW Lithium Powerstation",
        category: "Lithium Batteries",
        brand: "Betech Solar Select",
        price: 86400,
        oldPrice: 92000,
        image: "/agents/products/2kw-lithium-powerstation.jpeg",
        specs: ["2KW portable backup", "Compact form factor", "Fast deployment"],
        warranty: "18-month warranty",
        stockStatus: "in_stock",
        tags: ["portable", "lithium", "backup"],
      }),
    ],
  },
  {
    slug: "hybrid-inverters",
    title: "Hybrid Inverters",
    eyebrow: "Smart inverter options",
    description: "Hybrid inverter options for homes, biashara premises, and scalable solar backup builds.",
    products: [
      product({
        id: "inv-srne-3kw",
        slug: "srne-3kw-hybrid-inverter",
        name: "SRNE 3KW Hybrid Inverter",
        category: "Solar Inverters",
        brand: "SRNE",
        price: 48500,
        oldPrice: 53000,
        image: "/agents/product-inverter-clean.png",
        specs: ["3KW inverter", "Hybrid support", "Compact install footprint"],
        warranty: "12-month warranty",
        stockStatus: "in_stock",
        tags: ["inverter", "hybrid", "home-use"],
      }),
      product({
        id: "inv-srne-5kw",
        slug: "srne-5kw-hybrid-inverter",
        name: "SRNE 5KW Hybrid Inverter",
        category: "Solar Inverters",
        brand: "SRNE",
        price: 78000,
        oldPrice: 84000,
        image: "/agents/product-inverter-clean.png",
        specs: ["5KW inverter", "Lithium-ready", "For larger backup loads"],
        warranty: "18-month warranty",
        stockStatus: "in_stock",
        tags: ["inverter", "hybrid", "lithium-ready"],
      }),
      product({
        id: "inv-must-5-2",
        slug: "must-5-2kw-solar-inverter",
        name: "MUST 5.2KW Solar Inverter",
        category: "Solar Inverters",
        brand: "MUST",
        price: 89500,
        oldPrice: 94000,
        image: "/agents/product-inverter-clean.png",
        specs: ["5.2KW inverter", "Stable sine wave output", "Popular home backup option"],
        warranty: "12-month warranty",
        stockStatus: "in_stock",
        tags: ["inverter", "must", "best-value"],
      }),
      product({
        id: "inv-growatt-6kw",
        slug: "growatt-6kw-hybrid-inverter",
        name: "Growatt 6KW Hybrid Inverter",
        category: "Solar Inverters",
        brand: "Growatt",
        price: 118000,
        oldPrice: 124500,
        image: "/agents/product-inverter-clean.png",
        specs: ["6KW hybrid inverter", "Expandable system support", "Premium monitoring ready"],
        warranty: "24-month warranty",
        stockStatus: "quote_only",
        tags: ["inverter", "growatt", "premium"],
      }),
    ],
  },
  {
    slug: "water-pumps",
    title: "Water Pumps",
    eyebrow: "Solar water pumping",
    description: "Solar water pump solutions for irrigation, livestock, and borehole water delivery.",
    products: [
      product({
        id: "pump-750w-surface",
        slug: "750w-solar-surface-pump",
        name: "750W Solar Surface Pump",
        category: "Solar Water Pumps",
        brand: "Betech Solar Select",
        price: 62500,
        oldPrice: 69000,
        image: "/agents/product-water-pump-clean.png",
        specs: ["750W surface pump", "Farm use", "Lower running costs"],
        warranty: "12-month warranty",
        stockStatus: "in_stock",
        tags: ["pump", "surface-pump", "farm-use"],
      }),
      product({
        id: "pump-1-5hp-borehole",
        slug: "1-5hp-solar-borehole-pump-kit",
        name: "1.5HP Solar Borehole Pump Kit",
        category: "Solar Water Pumps",
        brand: "Betech Solar Select",
        price: 138000,
        oldPrice: 149000,
        image: "/agents/product-water-pump-clean.png",
        specs: ["1.5HP pump kit", "Borehole use", "Solar pumping package"],
        warranty: "18-month warranty",
        stockStatus: "limited_stock",
        tags: ["pump", "borehole", "irrigation"],
      }),
      product({
        id: "pump-dc-farm",
        slug: "dc-farm-irrigation-pump",
        name: "DC Farm Irrigation Pump",
        category: "Solar Water Pumps",
        brand: "Betech Solar Select",
        price: 84500,
        oldPrice: 91000,
        image: "/agents/product-water-pump-clean.png",
        specs: ["DC irrigation pump", "Farm watering", "Solar-compatible control"],
        warranty: "12-month warranty",
        stockStatus: "in_stock",
        tags: ["pump", "irrigation", "dc"],
      }),
      product({
        id: "pump-submersible",
        slug: "solar-submersible-pump-package",
        name: "Solar Submersible Pump Package",
        category: "Solar Water Pumps",
        brand: "Betech Solar Select",
        price: 156000,
        oldPrice: 168500,
        image: "/agents/product-water-pump-clean.png",
        specs: ["Submersible package", "Borehole-ready", "Higher lift application"],
        warranty: "18-month warranty",
        stockStatus: "quote_only",
        tags: ["pump", "submersible", "borehole"],
      }),
    ],
  },
  {
    slug: "solar-lights",
    title: "Solar Lights",
    eyebrow: "Lighting and security",
    description: "Solar lights for compound security, outdoor visibility, and everyday backup lighting.",
    products: [
      product({
        id: "light-flood-200w",
        slug: "200w-solar-flood-light",
        name: "200W Solar Flood Light",
        category: "Solar Lights",
        brand: "Betech Solar Select",
        price: 9800,
        oldPrice: 10800,
        image: "/agents/hero-generated-v2.png",
        specs: ["200W flood output", "Outdoor security", "Solar charge setup"],
        warranty: "6-month warranty",
        stockStatus: "in_stock",
        tags: ["light", "flood-light", "security"],
      }),
      product({
        id: "light-street-300w",
        slug: "300w-solar-street-light",
        name: "300W Solar Street Light",
        category: "Solar Lights",
        brand: "Betech Solar Select",
        price: 14500,
        oldPrice: 15900,
        image: "/agents/hero-generated-v2.png",
        specs: ["300W street light", "Compound use", "Outdoor security"],
        warranty: "6-month warranty",
        stockStatus: "in_stock",
        tags: ["light", "street-light", "compound"],
      }),
      product({
        id: "light-lantern-kit",
        slug: "portable-solar-lantern-kit",
        name: "Portable Solar Lantern Kit",
        category: "Solar Lights",
        brand: "Betech Solar Select",
        price: 4500,
        oldPrice: 5200,
        image: "/agents/hero-generated-v2.png",
        specs: ["Portable lantern", "Charging and lighting", "Easy daily backup"],
        warranty: "6-month warranty",
        stockStatus: "in_stock",
        tags: ["light", "portable", "lantern"],
      }),
      product({
        id: "light-wall-pack",
        slug: "solar-wall-light-twin-pack",
        name: "Solar Wall Light Twin Pack",
        category: "Solar Lights",
        brand: "Betech Solar Select",
        price: 6200,
        oldPrice: 6900,
        image: "/agents/hero-generated-v2.png",
        specs: ["Twin wall lights", "Outdoor fit", "Home security lighting"],
        warranty: "6-month warranty",
        stockStatus: "in_stock",
        tags: ["light", "wall-light", "home-security"],
      }),
    ],
  },
];

export const allShopProducts = shopProductSections.flatMap((section) => section.products);

export const footerGroups = [
  {
    title: "Shop Categories",
    links: [
      { label: "Solar Panels", href: "#solar-panels" },
      { label: "Inverters", href: "#hybrid-inverters" },
      { label: "Batteries", href: "#lithium-batteries" },
      { label: "Water Pumps", href: "#water-pumps" },
    ],
  },
  {
    title: "Get Help",
    links: [
      { label: "Request a Solar System Quote", href: "#quote" },
      { label: "Talk to our solar team on WhatsApp", href: "https://wa.me/254722151083" },
      { label: "Warranty support", href: "#support" },
      { label: "Delivered countrywide", href: "#support" },
    ],
  },
  {
    title: "Betech Solar Solutions",
    links: [
      { label: "Betech Solar Online Store", href: "/shop" },
      { label: "agents.betech.co.ke", href: "https://agents.betech.co.ke" },
      { label: "ops.betech.co.ke", href: "https://ops.betech.co.ke" },
      { label: "Visit our Nairobi CBD shop", href: "#support" },
    ],
  },
];
