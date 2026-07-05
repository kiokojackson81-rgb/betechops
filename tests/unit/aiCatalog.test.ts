import type { ShopProduct } from "@/app/shop/shopData";

jest.mock("@/app/shop/shopProductMapper", () => ({
  getOpsCatalogueProductsReadOnlyMapped: jest.fn(),
}));

const { getOpsCatalogueProductsReadOnlyMapped } = jest.requireMock("@/app/shop/shopProductMapper") as {
  getOpsCatalogueProductsReadOnlyMapped: jest.Mock;
};

function makeProduct(input: Partial<ShopProduct> & Pick<ShopProduct, "id" | "slug" | "name" | "category" | "brand" | "price" | "image" | "visualType" | "warranty" | "stockStatus" | "tags" | "whatsappMessage" | "source" | "opsProductId" | "specs">): ShopProduct {
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

describe("searchLiveCatalog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps Starmax full kit queries in single_product mode and ranks kits above accessories", async () => {
    const products: ShopProduct[] = [
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
        id: "kit-1",
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
        opsProductId: "kit-1",
        sku: "STARMAX-100W",
        specs: ["100W panel", "80AH battery", "300W inverter"],
      }),
      makeProduct({
        id: "kit-2",
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
        opsProductId: "kit-2",
        sku: "STARMAX-100W-FULL-KIT",
        specs: ["100W panel", "80AH battery", "300W inverter"],
      }),
    ];

    getOpsCatalogueProductsReadOnlyMapped.mockResolvedValue(products);

    const { searchLiveCatalog } = await import("@/lib/aiCatalog");
    const result = await searchLiveCatalog({
      query: "Starmax 100W Full Kit",
      origin: "https://www.betech.co.ke",
      limit: 8,
    });

    expect(result.queryType).toBe("single_product");
    expect(result.primary).not.toBeNull();
    expect(result.primary?.productName).toContain("Starmax 100W Full Kit");
    expect([13000, 19500]).toContain(result.primary?.price);
    expect(result.primary?.category).toBe("Solar Full Kits");
    expect(result.primary?.productName).not.toContain("1.5MM cable");
  });
});
