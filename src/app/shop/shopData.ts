export type ShopCategory = {
  slug: string;
  title: string;
  blurb: string;
  image: string;
  accent: "gold" | "maroon" | "green";
};

export type ShopProduct = {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  image: string;
  badge: string;
  warranty: string;
  availability: string;
  category: string;
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
  { label: "Quote", href: "#quote" },
];

export const shopCategories: ShopCategory[] = [
  {
    slug: "solar-panels",
    title: "Solar Panels",
    blurb: "Monocrystalline panels for home and commercial backup.",
    image: "/agents/product-solar-kit-clean.png",
    accent: "gold",
  },
  {
    slug: "solar-inverters",
    title: "Solar Inverters",
    blurb: "Hybrid and pure sine wave options for stable power.",
    image: "/agents/product-inverter-clean.png",
    accent: "maroon",
  },
  {
    slug: "solar-batteries",
    title: "Solar Batteries",
    blurb: "Deep-cycle storage for reliable backup power.",
    image: "/agents/product-battery-clean.png",
    accent: "green",
  },
  {
    slug: "lithium-batteries",
    title: "Lithium Batteries",
    blurb: "Compact lithium storage with longer cycle life.",
    image: "/agents/product-battery-clean.png",
    accent: "gold",
  },
  {
    slug: "solar-full-kits",
    title: "Solar Full Kits",
    blurb: "Ready bundles for homes, biashara, and small farms.",
    image: "/agents/product-solar-kit-clean.png",
    accent: "maroon",
  },
  {
    slug: "all-in-one-systems",
    title: "All-in-One Systems",
    blurb: "Integrated inverter and battery systems for quick setup.",
    image: "/agents/product-solar-kit-clean.png",
    accent: "green",
  },
  {
    slug: "solar-water-heaters",
    title: "Solar Water Heaters",
    blurb: "Efficient hot water systems for homes and rentals.",
    image: "/agents/cta-house-generated.png",
    accent: "gold",
  },
  {
    slug: "solar-water-pumps",
    title: "Solar Water Pumps",
    blurb: "Farm and borehole pumping solutions with lower running cost.",
    image: "/agents/product-water-pump-clean.png",
    accent: "green",
  },
  {
    slug: "solar-lights",
    title: "Solar Lights",
    blurb: "Outdoor, security, and everyday lighting options.",
    image: "/agents/hero-generated-v2.png",
    accent: "gold",
  },
  {
    slug: "accessories",
    title: "Accessories",
    blurb: "Mounting kits, cables, breakers, and add-ons.",
    image: "/agents/product-accessories-clean.png",
    accent: "maroon",
  },
  {
    slug: "request-quotation",
    title: "Request Quotation",
    blurb: "Get a custom system recommendation from the Betech team.",
    image: "/agents/top-agents-card.png",
    accent: "green",
  },
];

export const trustBadges = [
  {
    title: "Nationwide delivery",
    copy: "Ship, install, and support from one trusted solar team.",
  },
  {
    title: "Warranty-backed products",
    copy: "Structured mock data already includes warranty-ready fields.",
  },
  {
    title: "Quote-first buying",
    copy: "Ideal for homes, biashara, farms, schools, and pump projects.",
  },
  {
    title: "Prepared for ops sync",
    copy: "Catalog, POS, customers, and receipts can connect later cleanly.",
  },
];

export const heroHighlights = [
  {
    label: "Trusted across Kenya",
    value: "Homes, farms, and biashara",
    note: "Premium solar systems with the same Betech feel customers already know.",
  },
  {
    label: "Built for responsive shopping",
    value: "Mobile + desktop together",
    note: "No mobile-only shortcuts and no desktop afterthought layouts.",
  },
  {
    label: "Quote or order fast",
    value: "WhatsApp + cart-ready UI",
    note: "Mock storefront now, clean data structure for deeper commerce later.",
  },
];

export const shopProductSections: ShopProductSection[] = [
  {
    slug: "best-selling-solar-kits",
    title: "Best Selling Solar Kits",
    eyebrow: "Most requested bundles",
    description: "Starter and lithium-ready solar kits for homes, shops, and backup power needs.",
    products: [
      {
        id: "kit-starmax-300w",
        name: "Starmax 300W Full Kit",
        price: 38999,
        oldPrice: 42000,
        image: "/agents/products/starmax-300w-full-kit.jpeg",
        badge: "8% Off",
        warranty: "12-month warranty",
        availability: "In stock",
        category: "Full Kit",
      },
      {
        id: "kit-starmax-200w",
        name: "Starmax 200W Full Kit",
        price: 21999,
        oldPrice: 24500,
        image: "/agents/products/starmax-200w-full-kit.jpeg",
        badge: "Best Seller",
        warranty: "12-month warranty",
        availability: "Ready to ship",
        category: "Starter Kit",
      },
      {
        id: "kit-platinum-2-56",
        name: "Platinum 2.56KW Lithium Solar Kit",
        price: 70000,
        oldPrice: 76000,
        image: "/agents/products/platinum-2-56kw-lithium-solar-kit.jpeg",
        badge: "Bundle Deal",
        warranty: "18-month warranty",
        availability: "Limited stock",
        category: "Lithium Kit",
      },
      {
        id: "kit-srne-5kw",
        name: "SRNE 5KW Lithium Solar System",
        price: 280000,
        oldPrice: 305000,
        image: "/agents/products/srne-5kw-lithium-solar-system.jpeg",
        badge: "Premium Pick",
        warranty: "24-month warranty",
        availability: "Available",
        category: "Hybrid Kit",
      },
    ],
  },
  {
    slug: "solar-panels",
    title: "Solar Panels",
    eyebrow: "Panel collection",
    description: "Panel options for new installs, upgrades, and commercial backup projects.",
    products: [
      {
        id: "panel-jinko-550w",
        name: "Jinko 550W Mono Panel",
        price: 17500,
        oldPrice: 18900,
        image: "/agents/product-solar-kit-clean.png",
        badge: "High Output",
        warranty: "25-year performance",
        availability: "In stock",
        category: "Solar Panel",
      },
      {
        id: "panel-ja-450w",
        name: "JA Solar 450W Panel",
        price: 12800,
        oldPrice: 13950,
        image: "/agents/product-solar-kit-clean.png",
        badge: "Installer Choice",
        warranty: "12-year product",
        availability: "Available",
        category: "Solar Panel",
      },
      {
        id: "panel-jinko-300w",
        name: "Jinko 300W Panel",
        price: 9200,
        image: "/agents/product-solar-kit-clean.png",
        badge: "For starter kits",
        warranty: "12-year product",
        availability: "Ready to ship",
        category: "Solar Panel",
      },
      {
        id: "panel-growatt-600w",
        name: "600W Mono Utility Panel",
        price: 19800,
        oldPrice: 21400,
        image: "/agents/product-solar-kit-clean.png",
        badge: "Commercial Grade",
        warranty: "25-year performance",
        availability: "Available",
        category: "Solar Panel",
      },
    ],
  },
  {
    slug: "lithium-batteries",
    title: "Lithium Batteries",
    eyebrow: "Storage upgrade",
    description: "Compact high-cycle storage for reliable backup and hybrid inverter systems.",
    products: [
      {
        id: "battery-100ah-wall",
        name: "48V 100Ah Wall Mount Lithium Battery",
        price: 115000,
        oldPrice: 125000,
        image: "/agents/product-battery-clean.png",
        badge: "Top Rated",
        warranty: "24-month warranty",
        availability: "In stock",
        category: "Lithium Battery",
      },
      {
        id: "battery-200ah-rack",
        name: "48V 200Ah Rack Lithium Battery",
        price: 210000,
        oldPrice: 225000,
        image: "/agents/product-battery-clean.png",
        badge: "Heavy Backup",
        warranty: "24-month warranty",
        availability: "Available",
        category: "Lithium Battery",
      },
      {
        id: "battery-8kw-kit",
        name: "8KW Lithium Battery Kit",
        price: 350000,
        oldPrice: 375000,
        image: "/agents/products/8kw-lithium-battery-kit.jpeg",
        badge: "High Capacity",
        warranty: "24-month warranty",
        availability: "Limited stock",
        category: "Battery Kit",
      },
      {
        id: "battery-powerstation",
        name: "2KW Lithium Powerstation",
        price: 86400,
        oldPrice: 92000,
        image: "/agents/products/2kw-lithium-powerstation.jpeg",
        badge: "Portable Backup",
        warranty: "18-month warranty",
        availability: "Ready to ship",
        category: "Power Station",
      },
    ],
  },
  {
    slug: "hybrid-inverters",
    title: "Hybrid Inverters",
    eyebrow: "Smart conversion",
    description: "Hybrid inverter options for homes, biashara, and scalable lithium-ready systems.",
    products: [
      {
        id: "inv-srne-3kw",
        name: "SRNE 3KW Hybrid Inverter",
        price: 48500,
        oldPrice: 53000,
        image: "/agents/product-inverter-clean.png",
        badge: "Smart Hybrid",
        warranty: "12-month warranty",
        availability: "In stock",
        category: "Hybrid Inverter",
      },
      {
        id: "inv-srne-5kw",
        name: "SRNE 5KW Hybrid Inverter",
        price: 78000,
        oldPrice: 84000,
        image: "/agents/product-inverter-clean.png",
        badge: "Premium Pick",
        warranty: "18-month warranty",
        availability: "Available",
        category: "Hybrid Inverter",
      },
      {
        id: "inv-must-5-2",
        name: "MUST 5.2KW Solar Inverter",
        price: 89500,
        oldPrice: 94000,
        image: "/agents/product-inverter-clean.png",
        badge: "Best Value",
        warranty: "12-month warranty",
        availability: "Ready to ship",
        category: "Inverter",
      },
      {
        id: "inv-growatt-6kw",
        name: "Growatt 6KW Hybrid Inverter",
        price: 118000,
        oldPrice: 124500,
        image: "/agents/product-inverter-clean.png",
        badge: "Lithium Ready",
        warranty: "24-month warranty",
        availability: "Available",
        category: "Hybrid Inverter",
      },
    ],
  },
  {
    slug: "water-pumps",
    title: "Water Pumps",
    eyebrow: "Farm and borehole",
    description: "Solar pumping solutions for irrigation, livestock, and remote water delivery.",
    products: [
      {
        id: "pump-750w-surface",
        name: "750W Solar Surface Pump",
        price: 62500,
        oldPrice: 69000,
        image: "/agents/product-water-pump-clean.png",
        badge: "Farm Pick",
        warranty: "12-month warranty",
        availability: "Available",
        category: "Water Pump",
      },
      {
        id: "pump-1-5hp-borehole",
        name: "1.5HP Solar Borehole Pump Kit",
        price: 138000,
        oldPrice: 149000,
        image: "/agents/product-water-pump-clean.png",
        badge: "High Lift",
        warranty: "18-month warranty",
        availability: "In stock",
        category: "Water Pump",
      },
      {
        id: "pump-dc-farm",
        name: "DC Farm Irrigation Pump",
        price: 84500,
        oldPrice: 91000,
        image: "/agents/product-water-pump-clean.png",
        badge: "Irrigation",
        warranty: "12-month warranty",
        availability: "Ready to ship",
        category: "Water Pump",
      },
      {
        id: "pump-submersible",
        name: "Solar Submersible Pump Package",
        price: 156000,
        oldPrice: 168500,
        image: "/agents/product-water-pump-clean.png",
        badge: "Borehole Ready",
        warranty: "18-month warranty",
        availability: "Available",
        category: "Pump Package",
      },
    ],
  },
  {
    slug: "solar-lights",
    title: "Solar Lights",
    eyebrow: "Everyday lighting",
    description: "Security, compound, and portable solar lighting for homes and businesses.",
    products: [
      {
        id: "light-flood-200w",
        name: "200W Solar Flood Light",
        price: 9800,
        oldPrice: 10800,
        image: "/agents/hero-generated-v2.png",
        badge: "Outdoor Use",
        warranty: "6-month warranty",
        availability: "Available",
        category: "Solar Light",
      },
      {
        id: "light-street-300w",
        name: "300W Solar Street Light",
        price: 14500,
        oldPrice: 15900,
        image: "/agents/hero-generated-v2.png",
        badge: "Security",
        warranty: "6-month warranty",
        availability: "Ready to ship",
        category: "Solar Light",
      },
      {
        id: "light-lantern-kit",
        name: "Portable Solar Lantern Kit",
        price: 4500,
        oldPrice: 5200,
        image: "/agents/hero-generated-v2.png",
        badge: "Portable",
        warranty: "6-month warranty",
        availability: "In stock",
        category: "Lantern",
      },
      {
        id: "light-wall-pack",
        name: "Solar Wall Light Twin Pack",
        price: 6200,
        oldPrice: 6900,
        image: "/agents/hero-generated-v2.png",
        badge: "Home Pick",
        warranty: "6-month warranty",
        availability: "Available",
        category: "Outdoor Light",
      },
    ],
  },
];

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
    title: "Buy With Confidence",
    links: [
      { label: "Request a Quote", href: "#quote" },
      { label: "Warranty Support", href: "#support" },
      { label: "Nationwide Delivery", href: "#support" },
      { label: "WhatsApp Ordering", href: "https://wa.me/254722151083" },
    ],
  },
  {
    title: "Betech Solar",
    links: [
      { label: "agents.betech.co.ke", href: "https://agents.betech.co.ke" },
      { label: "ops.betech.co.ke", href: "https://ops.betech.co.ke" },
      { label: "www.betech.co.ke", href: "https://www.betech.co.ke" },
      { label: "Pramukh Plaza, Nairobi CBD", href: "#support" },
    ],
  },
];
