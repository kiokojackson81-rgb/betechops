import { SHOP_CATEGORY_DEFINITIONS } from "@/app/shop/shopCatalogConfig";
import {
  getShopCategoryHref,
  SHOP_DELIVERY_PAYMENT_HREF,
  SHOP_LIPA_POLE_POLE_HREF,
  SHOP_REQUEST_QUOTE_HREF,
  SHOP_WARRANTY_SUPPORT_HREF,
} from "@/app/shop/storefrontPaths";

export type ShopCategory = {
  slug: string;
  title: string;
  blurb: string;
  image: string;
  accent: "gold" | "maroon" | "green";
};

export type ShopProductVisualType =
  | "panel"
  | "inverter"
  | "battery"
  | "kit"
  | "pump"
  | "light"
  | "heater";

export type ShopProduct = {
  id: string;
  sku?: string;
  slug: string;
  name: string;
  category: string;
  subcategory?: string;
  brand: string;
  price: number;
  oldPrice?: number;
  image: string;
  galleryImages?: string[];
  brandImage?: string | null;
  tiktokVideoUrl?: string | null;
  visualType: ShopProductVisualType;
  shortDescription?: string;
  fullDescription?: string;
  specs: string[];
  warranty: string;
  warrantyNotes?: string;
  availabilityType?: "SHOP" | "WAREHOUSE";
  pickupDelayDays?: number;
  availabilityMessage?: string;
  checkoutAvailabilityMessage?: string;
  imageExtractedText?: string | null;
  stockStatus: "in_stock" | "limited_stock" | "preorder" | "quote_only";
  tags: string[];
  whatsappMessage: string;
  source: "mock" | "ops";
  opsProductId: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  commissionEnabled?: boolean;
  commissionAmount?: number | null;
  commissionRequiresApproval?: boolean;
  lipaPolePoleEnabled?: boolean;
  lipaPolePoleMinDeposit?: number | null;
  lipaPolePoleMaxDays?: number | null;
  lipaPolePoleDefaultDays?: number | null;
  lipaPolePoleTerms?: string | null;
};

export type ShopProductSection = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  products: ShopProduct[];
};

export const shopNavLinks = [
  { label: "Lipa Pole Pole", href: SHOP_LIPA_POLE_POLE_HREF },
  { label: "Solar Full Kits", href: getShopCategoryHref("solar-full-kits") },
  { label: "Solar Panels", href: getShopCategoryHref("solar-panels") },
  { label: "Batteries", href: getShopCategoryHref("solar-batteries") },
  { label: "Inverters", href: getShopCategoryHref("solar-inverters") },
  { label: "Pumps", href: getShopCategoryHref("solar-water-pumps") },
  { label: "Request Quote", href: SHOP_REQUEST_QUOTE_HREF },
];

export function buildShopCategories(imageOverrides: Record<string, string> = {}): ShopCategory[] {
  return SHOP_CATEGORY_DEFINITIONS.map((category) => ({
    slug: category.value,
    title: category.label,
    blurb: category.blurb,
    image: imageOverrides[category.value] ?? category.image,
    accent: category.accent,
  }));
}

export const shopCategories: ShopCategory[] = buildShopCategories();

export const trustBadges = [
  { title: "Genuine products", copy: "Trusted solar brands supplied by Betech Solar Solutions." },
  { title: "Warranty support", copy: "Clear warranty guidance on systems, batteries, panels and accessories." },
  { title: "Nairobi CBD shop", copy: "Visit Betech Solar Solutions at Pramukh Plaza, Nairobi CBD." },
  { title: "Countrywide delivery", copy: "Panels, batteries, pumps, heaters and kits delivered across Kenya." },
  { title: "Expert solar guidance", copy: "Our team helps size the right system before you commit." },
];

export const heroHighlights = [
  {
    label: "Official Betech store",
    value: "Betech Solar Online Store",
    note: "Shop genuine solar products with warranty support, Nairobi pickup, and countrywide delivery.",
  },
  {
    label: "Delivered countrywide",
    value: "Panels to full systems",
    note: "We deliver solar panels, batteries, inverters, pumps and kits across Kenya.",
  },
  {
    label: "Not sure what you need?",
    value: "Request a solar quote",
    note: "Our team will help size the right panels, inverter, battery and accessories for your needs.",
  },
];

export const shopReasons = [
  "Genuine solar products",
  "Warranty support",
  "Expert system sizing",
  "Nairobi CBD shop",
  "Countrywide delivery",
  "WhatsApp support",
] as const;

export const deliveryPaymentSteps = [
  {
    title: "Nairobi orders",
    copy: "Rider delivery is available in Nairobi, and some orders can be handled with pay on delivery.",
  },
  {
    title: "Outside Nairobi",
    copy: "Courier delivery is available countrywide based on product size, location, and transport planning.",
  },
  {
    title: "Payment guidance",
    copy: "Customers may pay transport fee, deposit, or full amount depending on the order and delivery arrangement.",
  },
  {
    title: "Shop pickup",
    copy: "Pickup is available from our Nairobi CBD shop at Pramukh Plaza once the order is confirmed.",
  },
] as const;

function product(input: Omit<ShopProduct, "source" | "opsProductId">): ShopProduct {
  return { ...input, source: "mock", opsProductId: null };
}

export const shopProductSections: ShopProductSection[] = [
  {
    slug: "best-selling-solar-kits",
    title: "Best Selling Solar Kits",
    eyebrow: "Customer-ready full systems",
    description: "Practical Betech Solar sample kits for homes, businesses, and backup needs.",
    products: [
      product({
        id: "kit-1kw-full",
        slug: "1kw-solar-full-kit",
        name: "1KW Solar Full Kit",
        category: "Solar Full Kits",
        brand: "Betech Solar Select",
        price: 64999,
        oldPrice: 69999,
        image: "/agents/product-solar-kit-clean.png",
        visualType: "kit",
        specs: ["1KW inverter system", "Battery and panel ready", "Ideal for lights, TV and charging"],
        warranty: "12-month warranty",
        stockStatus: "in_stock",
        tags: ["starter kit", "home backup", "best seller"],
        whatsappMessage: "Hello Betech Solar, I want to order the 1KW Solar Full Kit.",
      }),
      product({
        id: "kit-3kw-full",
        slug: "3kw-solar-full-kit",
        name: "3KW Solar Full Kit",
        category: "Solar Full Kits",
        brand: "Betech Solar Select",
        price: 184999,
        oldPrice: 198000,
        image: "/agents/product-solar-kit-clean.png",
        visualType: "kit",
        specs: ["3KW hybrid-ready setup", "Suitable for home and biashara backup", "Expandable system path"],
        warranty: "18-month warranty",
        stockStatus: "limited_stock",
        tags: ["hybrid kit", "business backup", "popular"],
        whatsappMessage: "Hello Betech Solar, I want more details about the 3KW Solar Full Kit.",
      }),
      product({
        id: "kit-5kw-full",
        slug: "5kw-solar-full-kit",
        name: "5KW Solar Full Kit",
        category: "Solar Full Kits",
        brand: "Betech Solar Select",
        price: 329999,
        oldPrice: 348000,
        image: "/agents/product-solar-kit-clean.png",
        visualType: "kit",
        specs: ["5KW full solar system", "For larger homes and biashara", "Supports stronger daytime loads"],
        warranty: "24-month warranty",
        stockStatus: "quote_only",
        tags: ["premium kit", "full solution", "quote first"],
        whatsappMessage: "Hello Betech Solar, I need a quote for the 5KW Solar Full Kit.",
      }),
    ],
  },
  {
    slug: "solar-panels",
    title: "Solar Panels",
    eyebrow: "High-output mono panels",
    description: "Realistic panel samples for modern rooftops, farms, institutions and backup systems.",
    products: [
      product({
        id: "panel-585w",
        slug: "585w-solar-panel",
        name: "585W Solar Panel",
        category: "Solar Panels",
        brand: "Jinko Solar",
        price: 17999,
        oldPrice: 19200,
        image: "/agents/product-solar-kit-clean.png",
        visualType: "panel",
        specs: ["585W mono panel", "High efficiency generation", "Suitable for home and business rooftops"],
        warranty: "12-year product warranty",
        stockStatus: "in_stock",
        tags: ["mono panel", "high output", "roof top"],
        whatsappMessage: "Hello Betech Solar, I want to order the 585W Solar Panel.",
      }),
      product({
        id: "panel-620w",
        slug: "620w-solar-panel",
        name: "620W Solar Panel",
        category: "Solar Panels",
        brand: "JA Solar",
        price: 20500,
        oldPrice: 21800,
        image: "/agents/product-solar-kit-clean.png",
        visualType: "panel",
        specs: ["620W mono panel", "Higher output for larger installs", "Commercial and large home use"],
        warranty: "12-year product warranty",
        stockStatus: "limited_stock",
        tags: ["utility panel", "high output", "commercial"],
        whatsappMessage: "Hello Betech Solar, I want more details about the 620W Solar Panel.",
      }),
    ],
  },
  {
    slug: "solar-batteries",
    title: "Solar Batteries",
    eyebrow: "Gel and lithium storage",
    description: "Battery samples for daily backup, deeper reserve capacity and lithium upgrades.",
    products: [
      product({
        id: "battery-100ah-gel",
        slug: "100ah-gel-battery",
        name: "100AH Gel Battery",
        category: "Solar Batteries",
        brand: "Ritar",
        price: 24500,
        oldPrice: 26200,
        image: "/agents/product-battery-clean.png",
        visualType: "battery",
        specs: ["100AH deep-cycle gel battery", "Reliable home backup", "Works with starter and mid-range kits"],
        warranty: "12-month warranty",
        stockStatus: "in_stock",
        tags: ["gel battery", "deep cycle", "home backup"],
        whatsappMessage: "Hello Betech Solar, I want to order the 100AH Gel Battery.",
      }),
      product({
        id: "battery-200ah-gel",
        slug: "200ah-gel-battery",
        name: "200AH Gel Battery",
        category: "Solar Batteries",
        brand: "Vision",
        price: 43800,
        oldPrice: 45500,
        image: "/agents/product-battery-clean.png",
        visualType: "battery",
        specs: ["200AH deep-cycle gel battery", "Longer reserve time", "Suitable for stronger backup demands"],
        warranty: "12-month warranty",
        stockStatus: "limited_stock",
        tags: ["gel battery", "reserve backup", "heavy duty"],
        whatsappMessage: "Hello Betech Solar, I need pricing for the 200AH Gel Battery.",
      }),
      product({
        id: "battery-100ah-lithium",
        slug: "100ah-lithium-battery",
        name: "100AH Lithium Battery",
        category: "Lithium Batteries",
        brand: "Felicity Solar",
        price: 118000,
        oldPrice: 126500,
        image: "/agents/product-battery-clean.png",
        visualType: "battery",
        specs: ["100AH lithium storage", "Long cycle life", "Clean fit for hybrid inverter systems"],
        warranty: "24-month warranty",
        stockStatus: "in_stock",
        tags: ["lithium battery", "hybrid ready", "long cycle"],
        whatsappMessage: "Hello Betech Solar, I want to order the 100AH Lithium Battery.",
      }),
      product({
        id: "battery-200ah-lithium",
        slug: "200ah-lithium-battery",
        name: "200AH Lithium Battery",
        category: "Lithium Batteries",
        brand: "SRNE",
        price: 214999,
        oldPrice: 229999,
        image: "/agents/product-battery-clean.png",
        visualType: "battery",
        specs: ["200AH lithium storage", "Longer runtime for home and biashara", "Premium backup option"],
        warranty: "24-month warranty",
        stockStatus: "quote_only",
        tags: ["lithium battery", "premium backup", "quote first"],
        whatsappMessage: "Hello Betech Solar, I need a quote for the 200AH Lithium Battery.",
      }),
    ],
  },
  {
    slug: "hybrid-inverters",
    title: "Hybrid Inverters",
    eyebrow: "Core power conversion",
    description: "Hybrid inverter samples for smaller homes up to larger backup and biashara systems.",
    products: [
      product({
        id: "inverter-1-2kw-hybrid",
        slug: "1-2kw-hybrid-inverter",
        name: "1.2KW Hybrid Inverter",
        category: "Solar Inverters",
        brand: "MUST",
        price: 28999,
        oldPrice: 31500,
        image: "/agents/product-inverter-clean.png",
        visualType: "inverter",
        specs: ["1.2KW hybrid inverter", "Compact backup use", "For starter home loads"],
        warranty: "12-month warranty",
        stockStatus: "in_stock",
        tags: ["hybrid inverter", "starter size", "home use"],
        whatsappMessage: "Hello Betech Solar, I want to order the 1.2KW Hybrid Inverter.",
      }),
      product({
        id: "inverter-3-5kw-hybrid",
        slug: "3-5kw-hybrid-inverter",
        name: "3.5KW Hybrid Inverter",
        category: "Solar Inverters",
        brand: "SRNE",
        price: 78500,
        oldPrice: 82999,
        image: "/agents/product-inverter-clean.png",
        visualType: "inverter",
        specs: ["3.5KW hybrid inverter", "Ideal for home and biashara backup", "Lithium-ready expansion path"],
        warranty: "18-month warranty",
        stockStatus: "in_stock",
        tags: ["hybrid inverter", "popular", "lithium ready"],
        whatsappMessage: "Hello Betech Solar, I need pricing for the 3.5KW Hybrid Inverter.",
      }),
      product({
        id: "inverter-5kw-hybrid",
        slug: "5kw-hybrid-inverter",
        name: "5KW Hybrid Inverter",
        category: "Solar Inverters",
        brand: "Growatt",
        price: 124999,
        oldPrice: 132500,
        image: "/agents/product-inverter-clean.png",
        visualType: "inverter",
        specs: ["5KW hybrid inverter", "For larger loads and day power use", "Premium monitoring-ready system core"],
        warranty: "24-month warranty",
        stockStatus: "limited_stock",
        tags: ["hybrid inverter", "premium", "larger load"],
        whatsappMessage: "Hello Betech Solar, I want more details about the 5KW Hybrid Inverter.",
      }),
    ],
  },
  {
    slug: "water-pumps",
    title: "Water Pumps",
    eyebrow: "Water and outdoor solutions",
    description: "Solar pumping, lighting and water heating samples for farms, compounds and homes.",
    products: [
      product({
        id: "pump-dc-12v",
        slug: "dc-12v-solar-water-pump",
        name: "DC 12V Solar Water Pump",
        category: "Solar Water Pumps",
        brand: "ALLTOP",
        price: 36999,
        oldPrice: 38999,
        image: "/agents/product-water-pump-clean.png",
        visualType: "pump",
        specs: ["12V DC pump", "Suitable for tanks and small irrigation", "Low running cost solar pumping"],
        warranty: "12-month warranty",
        stockStatus: "in_stock",
        tags: ["water pump", "dc pump", "farm use"],
        whatsappMessage: "Hello Betech Solar, I want to order the DC 12V Solar Water Pump.",
      }),
      product({
        id: "light-solar-flood",
        slug: "solar-flood-light",
        name: "Solar Flood Light",
        category: "Solar Lights",
        brand: "ALLTOP",
        price: 9800,
        oldPrice: 11200,
        image: "/agents/hero-generated-v2.png",
        visualType: "light",
        specs: ["Outdoor flood lighting", "Security and compound use", "Standalone solar charging setup"],
        warranty: "6-month warranty",
        stockStatus: "in_stock",
        tags: ["solar light", "security", "compound"],
        whatsappMessage: "Hello Betech Solar, I want to order the Solar Flood Light.",
      }),
      product({
        id: "heater-solar-water",
        slug: "solar-water-heater",
        name: "Solar Water Heater",
        category: "Solar Water Heaters",
        brand: "Generic Solar Thermal",
        price: 89999,
        oldPrice: 95000,
        image: "/agents/cta-house-generated.png",
        visualType: "heater",
        specs: ["Roof-mounted water heating", "For homes and rentals", "Helps reduce electricity cost"],
        warranty: "12-month warranty",
        stockStatus: "preorder",
        tags: ["water heater", "home use", "pre-order"],
        whatsappMessage: "Hello Betech Solar, I want to request details for the Solar Water Heater.",
      }),
    ],
  },
];

export const allShopProducts = shopProductSections.flatMap((section) => section.products);

export const footerGroups = [
  {
    title: "Contact & Social",
    links: [
      { label: "Call: 0722 151 083", href: "tel:+254722151083", icon: "phone" },
      { label: "Call: 0703 241 917", href: "tel:+254703241917", icon: "phone" },
      { label: "Call: 0716 722 151", href: "tel:+254716722151", icon: "phone" },
      { label: "WhatsApp our team", href: "https://wa.me/254722151083", icon: "message" },
      { label: "info@betech.co.ke", href: "mailto:info@betech.co.ke", icon: "mail" },
      { label: "TikTok", href: "https://www.tiktok.com/@betechsolarsolutionske", icon: "play" },
      { label: "Recent solar projects", href: "https://www.tiktok.com/@betechsolarprojects", icon: "projects" },
      { label: "Facebook", href: "https://web.facebook.com/profile.php?id=61567374346730", icon: "social" },
    ],
  },
  {
    title: "Get Help",
    links: [
      { label: "Request a Solar System Quote", href: SHOP_REQUEST_QUOTE_HREF, icon: "quote" },
      { label: "Warranty support", href: SHOP_WARRANTY_SUPPORT_HREF, icon: "warranty" },
      { label: "Lipa Pole Pole", href: SHOP_LIPA_POLE_POLE_HREF, icon: "payment" },
      { label: "Solar Installation Terms & Conditions", href: "/p/terms", icon: "terms" },
      { label: "Delivery, Installation & Payments", href: SHOP_DELIVERY_PAYMENT_HREF, icon: "delivery" },
    ],
  },
  {
    title: "Betech Solar Solutions",
    links: [
      { label: "Betech Solar Online Store", href: "/", icon: "store" },
      { label: "Agents portal", href: "https://agents.betech.co.ke", icon: "external" },
      { label: "Operations portal", href: "https://ops.betech.co.ke", icon: "external" },
      { label: "Get shop directions", href: "https://www.tiktok.com/@betechsolarsolutionske/video/7546869303308569861", icon: "location" },
    ],
  },
];
