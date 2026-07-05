import type { ShopProduct } from "@/app/shop/shopData";

jest.mock("@/app/shop/shopProductMapper", () => ({
  getOpsCatalogueProductsReadOnlyMapped: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    orderItem: { findMany: jest.fn().mockResolvedValue([]) },
    websiteOrderItem: { findMany: jest.fn().mockResolvedValue([]) },
    marketingReceiptItem: { findMany: jest.fn().mockResolvedValue([]) },
    supportReceiptItem: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

const { getOpsCatalogueProductsReadOnlyMapped } = jest.requireMock("@/app/shop/shopProductMapper") as {
  getOpsCatalogueProductsReadOnlyMapped: jest.Mock;
};

function makeProduct(
  input: Partial<ShopProduct> &
    Pick<
      ShopProduct,
      | "id"
      | "slug"
      | "name"
      | "category"
      | "brand"
      | "price"
      | "image"
      | "visualType"
      | "warranty"
      | "stockStatus"
      | "tags"
      | "whatsappMessage"
      | "source"
      | "opsProductId"
      | "specs"
    >,
): ShopProduct {
  return {
    shortDescription: "",
    fullDescription: "",
    availabilityMessage: "Available at Shop",
    checkoutAvailabilityMessage: "Available at Shop",
    subcategory: "",
    sku: "",
    imageExtractedText: "",
    ...input,
  };
}

const PRODUCTS: ShopProduct[] = [
  makeProduct({
    id: "acc-1",
    slug: "1-5mm-cable",
    name: "1.5MM cable",
    category: "Solar Accessories",
    brand: "Generic",
    price: 22,
    image: "/cable.png",
    visualType: "light",
    warranty: "No warranty",
    stockStatus: "in_stock",
    tags: ["cable", "accessory"],
    whatsappMessage: "cable",
    source: "ops",
    opsProductId: "acc-1",
    specs: ["1.5mm solar cable"],
  }),
  makeProduct({
    id: "kit-100w-1",
    slug: "starmax-100w-full-kit-solarmax-100w-solar-panel-starmax-80ah-battery-solarmax-300w-inverter-solarmax-10a-controller-5-dc-bulbs-10m-cable",
    name: "Starmax 100W Full Kit : Solarmax 100W Solar Panel , Starmax 80AH Battery , Solarmax 300W Inverter , Solarmax 10A Controller , 5 DC Bulbs , 10M Cable",
    category: "Solar Full Kits",
    subcategory: "Gel Solar Kits",
    brand: "Starmax",
    price: 13000,
    image: "/kit.png",
    visualType: "kit",
    warranty: "1 Year",
    stockStatus: "quote_only",
    tags: ["full kit", "100w"],
    whatsappMessage: "kit",
    source: "ops",
    opsProductId: "kit-100w-1",
    sku: "STARMAX-100W",
    specs: ["100W panel", "80AH battery", "300W inverter"],
  }),
  makeProduct({
    id: "kit-100w-2",
    slug: "starmax-100w-full-kit",
    name: "Starmax 100W Full Kit",
    category: "Solar Full Kits",
    subcategory: "Gel Solar Kits",
    brand: "Starmax",
    price: 19500,
    image: "/kit2.png",
    visualType: "kit",
    warranty: "1 Year",
    stockStatus: "quote_only",
    tags: ["full kit", "100w"],
    whatsappMessage: "kit2",
    source: "ops",
    opsProductId: "kit-100w-2",
    sku: "STARMAX-100W-FULL-KIT",
    specs: ["100W panel", "80AH battery", "300W inverter"],
  }),
  makeProduct({
    id: "kit-2kw",
    slug: "2kw-lithium-solar-kit",
    name: "2KW Lithium Solar Kit",
    category: "Solar Full Kits",
    brand: "SRNE",
    price: 189000,
    image: "/2kw.png",
    visualType: "kit",
    warranty: "2 Years",
    stockStatus: "in_stock",
    tags: ["2kw", "lithium", "kit"],
    whatsappMessage: "2kw",
    source: "ops",
    opsProductId: "kit-2kw",
    specs: ["2KW inverter", "lithium battery", "solar panels"],
  }),
  makeProduct({
    id: "kit-5kw",
    slug: "5kw-lithium-solar-kit",
    name: "5KW Lithium Solar Kit",
    category: "Solar Full Kits",
    brand: "SRNE",
    price: 280000,
    image: "/5kw-kit.png",
    visualType: "kit",
    warranty: "2 Years",
    stockStatus: "in_stock",
    tags: ["5kw", "lithium", "kit"],
    whatsappMessage: "5kw kit",
    source: "ops",
    opsProductId: "kit-5kw",
    specs: ["5KW inverter", "lithium battery", "solar panels"],
  }),
  makeProduct({
    id: "inv-5kw",
    slug: "5kw-hybrid-inverter",
    name: "5KW Hybrid Inverter",
    category: "Solar Inverters",
    brand: "Growatt",
    price: 124999,
    image: "/5kw-inverter.png",
    visualType: "inverter",
    warranty: "2 Years",
    stockStatus: "in_stock",
    tags: ["5kw", "inverter"],
    whatsappMessage: "5kw inverter",
    source: "ops",
    opsProductId: "inv-5kw",
    specs: ["5KW hybrid inverter"],
  }),
];

describe("searchLiveCatalog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getOpsCatalogueProductsReadOnlyMapped.mockResolvedValue(PRODUCTS);
  });

  it("keeps Starmax full kit queries in single_product mode and ranks kits above accessories", async () => {
    const { searchLiveCatalog } = await import("@/lib/aiCatalog");
    const result = await searchLiveCatalog({
      query: "Starmax 100W Full Kit",
      origin: "https://www.betech.co.ke",
      limit: 8,
    });

    expect(result.queryType).toBe("single_product");
    expect(result.primary?.productName).toContain("Starmax 100W Full Kit");
    expect([13000, 19500]).toContain(result.primary?.price);
    expect(result.primary?.category).toBe("Solar Full Kits");
    expect(result.primary?.productName).not.toContain("1.5MM cable");
  });

  it("prefers complete 5KW kits for generic 5KW system queries", async () => {
    const { searchLiveCatalog } = await import("@/lib/aiCatalog");
    const result = await searchLiveCatalog({
      query: "I want 5KW",
      origin: "https://www.betech.co.ke",
      limit: 8,
    });

    expect(result.queryType).toBe("category_list");
    expect(result.primary?.productName).toContain("5KW Lithium Solar Kit");
    expect(result.recommendationReason.toLowerCase()).toContain("complete system");
  });

  it("returns inverter products for explicit inverter intent", async () => {
    const { searchLiveCatalog } = await import("@/lib/aiCatalog");
    const result = await searchLiveCatalog({
      query: "5KW inverter",
      origin: "https://www.betech.co.ke",
      limit: 8,
    });

    expect(result.queryType).toBe("category_list");
    expect(result.primary?.productName).toContain("5KW Hybrid Inverter");
    expect(result.primary?.category).toBe("Solar Inverters");
  });

  it("asks sizing questions for vague home solar requests", async () => {
    const { searchLiveCatalog } = await import("@/lib/aiCatalog");
    const result = await searchLiveCatalog({
      query: "I need solar for 3 bedroom house",
      origin: "https://www.betech.co.ke",
      limit: 8,
    });

    expect(result.queryType).toBe("need_based_recommendation");
    expect(result.found).toBe(false);
    expect(result.needsMoreInfo).toBe(true);
    expect(result.questionsToAsk.length).toBeGreaterThan(0);
  });

  it("estimates appliance loads and recommends a suitable live system", async () => {
    const { searchLiveCatalog } = await import("@/lib/aiCatalog");
    const result = await searchLiveCatalog({
      query: "I have 10 lights, TV, fridge and WiFi",
      origin: "https://www.betech.co.ke",
      limit: 8,
    });

    expect(result.queryType).toBe("need_based_recommendation");
    expect(result.estimate?.runningLoadWatts).toBeGreaterThan(0);
    expect(result.estimate?.recommendedSystemSize).toBe("2KW");
    expect(result.primary?.productName).toContain("2KW Lithium Solar Kit");
  });

  it("allows accessories when the customer explicitly asks for solar cable", async () => {
    const { searchLiveCatalog } = await import("@/lib/aiCatalog");
    const result = await searchLiveCatalog({
      query: "Solar cable",
      origin: "https://www.betech.co.ke",
      limit: 8,
    });

    expect(result.queryType).toBe("category_list");
    expect(result.primary?.productName).toContain("cable");
  });

  it("returns kits only for generic solar kit searches", async () => {
    const { searchLiveCatalog } = await import("@/lib/aiCatalog");
    const result = await searchLiveCatalog({
      query: "Solar kit",
      origin: "https://www.betech.co.ke",
      limit: 8,
    });

    expect(result.queryType).toBe("category_list");
    expect(result.primary?.category).toBe("Solar Full Kits");
    expect(result.primary?.productName).not.toContain("cable");
  });
});
