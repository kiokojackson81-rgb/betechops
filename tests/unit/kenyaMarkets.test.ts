import {
  getCheckoutTownsForCounty,
  getServiceZone,
  getSiteVisitFee,
  isKnownTownForCounty,
  kenyaCountyMarkets,
  normalizeKenyaLocationName,
  resolveCheckoutTown,
  searchCheckoutTowns,
  UNLISTED_TOWN_OPTION,
} from "@/lib/agents/kenyaMarkets";

describe("Kenya service zones", () => {
  it.each([
    ["Nairobi", "Nairobi CBD", "ZONE_1", 2_000],
    ["Kiambu", "Thika", "ZONE_1", 2_000],
    ["Machakos", "Athi River", "ZONE_1", 2_000],
    ["Kajiado", "Kitengela", "ZONE_1", 2_000],
    ["Nakuru", "Nakuru", "ZONE_2", 5_000],
    ["Nakuru", "Naivasha", "ZONE_2", 5_000],
    ["Embu", "Embu", "ZONE_2", 5_000],
    ["Kitui", "Mwingi", "ZONE_2", 5_000],
    ["Kericho", "Kericho", "ZONE_2", 5_000],
    ["Bomet", "Bomet", "ZONE_2", 5_000],
    ["Kilifi", "Watamu", "ZONE_3", 10_000],
    ["Kisumu", "Kisumu", "ZONE_3", 10_000],
    ["Mombasa", "Mombasa", "ZONE_3", 10_000],
    ["Uasin Gishu", "Eldoret", "ZONE_3", 10_000],
    ["Nairobi", "Westlands", "ZONE_1", 2_000],
    ["Kiambu", "Ruiru-Kihunguro", "ZONE_1", 2_000],
    ["Machakos", "Syokimau", "ZONE_1", 2_000],
    ["Kajiado", "Ongata Rongai", "ZONE_1", 2_000],
    ["Murang'a", "Kenol", "ZONE_2", 5_000],
    ["Kirinyaga", "Wang’uru", "ZONE_2", 5_000],
    ["Kakamega", "Mumias", "ZONE_3", 10_000],
    ["Busia", "Port Victoria", "ZONE_3", 10_000],
    ["Garissa", "Dadaab", "ZONE_3", 10_000],
    ["Taita Taveta", "Voi", "ZONE_3", 10_000],
  ])("maps %s / %s to %s", (county, town, expectedZone, expectedFee) => {
    expect(getServiceZone(county, town)?.id).toBe(expectedZone);
    expect(getSiteVisitFee(county, town)).toBe(expectedFee);
  });

  it("normalizes apostrophes, hyphens, casing, spacing, and County suffixes", () => {
    expect(getServiceZone("MURANG'A COUNTY", "Murang’a")?.id).toBe("ZONE_2");
    expect(getServiceZone("Tharaka-Nithi", "Chuka")?.id).toBe("ZONE_3");
    expect(getServiceZone(" Elgeyo-Marakwet County ", "Iten")?.id).toBe("ZONE_3");
    expect(normalizeKenyaLocationName("Murang’a County")).toBe("murang a");
  });

  it("rejects unknown counties and towns instead of silently assigning a zone", () => {
    expect(getServiceZone("Unknown County", "Unknown Town")).toBeNull();
    expect(getServiceZone("Nairobi", "Watamu")).toBeNull();
  });

  it("maps every configured county and town to exactly one zone", () => {
    expect(kenyaCountyMarkets).toHaveLength(47);
    const counties = new Set<string>();
    for (const market of kenyaCountyMarkets) {
      const countyKey = normalizeKenyaLocationName(market.county);
      expect(counties.has(countyKey)).toBe(false);
      counties.add(countyKey);
      expect(getServiceZone(market.county)?.id).toBe(market.zone);

      const towns = new Set<string>();
      for (const town of market.towns) {
        const townKey = normalizeKenyaLocationName(town);
        expect(towns.has(townKey)).toBe(false);
        towns.add(townKey);
        expect(getServiceZone(market.county, town)?.id).toBe(market.zone);
      }
    }
  });

  it("adds the unlisted-area option last for every county without changing generic town lists", () => {
    for (const market of kenyaCountyMarkets) {
      const checkoutTowns = getCheckoutTownsForCounty(market.county);
      expect(checkoutTowns.at(-1)).toBe(UNLISTED_TOWN_OPTION);
      expect(checkoutTowns.slice(0, -1)).toEqual(market.towns);
    }
  });

  it("keeps the unlisted-area option last even while searching", () => {
    expect(searchCheckoutTowns("Nairobi", "west")).toEqual(["Westlands", "Kahawa West", UNLISTED_TOWN_OPTION]);
    expect(searchCheckoutTowns("Kiambu", "ruiru").at(-1)).toBe(UNLISTED_TOWN_OPTION);
    expect(searchCheckoutTowns("Kisumu", "no match")).toEqual([UNLISTED_TOWN_OPTION]);
  });

  it("accepts only towns from the selected county unless the customer enters a manual area", () => {
    expect(isKnownTownForCounty("Nairobi", "Westlands")).toBe(true);
    expect(isKnownTownForCounty("Nairobi", "Watamu")).toBe(false);
    expect(resolveCheckoutTown("Nairobi", "Westlands")).toMatchObject({
      town: "Westlands",
      townSource: "predefined",
      zone: { id: "ZONE_1" },
    });
    expect(resolveCheckoutTown("Nairobi", UNLISTED_TOWN_OPTION)).toBeNull();
  });

  it("stores a manual town and inherits its county zone", () => {
    expect(resolveCheckoutTown("Nakuru", UNLISTED_TOWN_OPTION, "Keringet")).toMatchObject({
      town: "Keringet",
      townSource: "manual",
      zone: { id: "ZONE_2" },
    });
    expect(resolveCheckoutTown("Kilifi", UNLISTED_TOWN_OPTION, "Mnarani")).toMatchObject({
      town: "Mnarani",
      townSource: "manual",
      zone: { id: "ZONE_3" },
    });
  });
});
