import {
  calculateTransportFee,
  type ProductCatalogueConfiguration,
} from "@/lib/productCataloguePolicy";

const basePolicy: ProductCatalogueConfiguration = {
  installationType: "NOT_REQUIRED",
  installationFeeMode: "UNAVAILABLE",
  customInstallationFee: null,
  accessoriesMode: "NOT_INCLUDED",
  preliminaryAccessoriesFee: null,
  includedAccessories: "",
  installationNotes: "",
  transportMode: "ZONE",
  useDefaultTransportRates: true,
  zone1TransportFee: null,
  zone2TransportFee: null,
  zone3TransportFee: null,
  priceIncludes: ["EQUIPMENT"],
  allInclusive: false,
  allInclusiveItems: [],
  structuredSpecifications: [],
  componentWarranties: [],
  projectImageUrls: [],
  requiresSiteAssessment: false,
};

describe("calculateTransportFee", () => {
  it("uses the published fallback only when a product zone fee is absent", () => {
    expect(calculateTransportFee("ZONE_1", basePolicy)).toEqual({ status: "PRICED", amount: 500 });
    expect(calculateTransportFee("ZONE_2", basePolicy)).toEqual({ status: "PRICED", amount: 1000 });
    expect(calculateTransportFee("ZONE_3", basePolicy)).toEqual({ status: "PRICED", amount: 1500 });
  });

  it("uses the configured product service-zone fee instead of the global setting", () => {
    expect(calculateTransportFee("ZONE_3", { ...basePolicy, zone3TransportFee: 2250 })).toEqual({
      status: "PRICED",
      amount: 2250,
    });
  });

  it("does not charge transport when the product includes it", () => {
    expect(calculateTransportFee("ZONE_2", { ...basePolicy, transportMode: "INCLUDED" })).toEqual({
      status: "INCLUDED",
      amount: 0,
    });
  });
});
