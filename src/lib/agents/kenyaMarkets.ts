export type ServiceZone = "ZONE_1" | "ZONE_2" | "ZONE_3";

export type ServiceZoneConfig = {
  id: ServiceZone;
  name: string;
  siteVisitFee: number;
  defaultDeliveryFee: number | null;
};

export const serviceZoneConfig: Record<ServiceZone, ServiceZoneConfig> = {
  ZONE_1: { id: "ZONE_1", name: "Zone 1 — Nairobi Metropolitan Area", siteVisitFee: 2_000, defaultDeliveryFee: null },
  ZONE_2: { id: "ZONE_2", name: "Zone 2 — Near-Nairobi Service Area", siteVisitFee: 5_000, defaultDeliveryFee: null },
  ZONE_3: { id: "ZONE_3", name: "Zone 3 — Long-Distance Service Area", siteVisitFee: 10_000, defaultDeliveryFee: null },
};

const zoneOneCounties = new Set(["nairobi", "kiambu", "machakos", "kajiado"]);
const zoneTwoCounties = new Set([
  "murang a", "kirinyaga", "nyeri", "nyandarua", "nakuru", "embu", "makueni",
  "kitui", "narok", "laikipia", "kericho", "bomet",
]);

export function normalizeKenyaLocationName(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[’'`]/g, " ")
    .replace(/-/g, " ")
    .replace(/\bcounty\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const kenyaCountyMarketEntries = [
  { county: "Mombasa", towns: ["Mombasa", "Nyali", "Bamburi", "Likoni", "Changamwe"] },
  { county: "Kwale", towns: ["Ukunda", "Diani", "Msambweni", "Kwale", "Lunga Lunga"] },
  { county: "Kilifi", towns: ["Kilifi", "Malindi", "Mariakani", "Watamu", "Mtwapa"] },
  { county: "Tana River", towns: ["Hola", "Garsen", "Bura"] },
  { county: "Lamu", towns: ["Lamu", "Mpeketoni", "Witu"] },
  { county: "Taita Taveta", towns: ["Voi", "Taveta", "Wundanyi", "Mwatate"] },
  { county: "Garissa", towns: ["Garissa", "Dadaab", "Modogashe"] },
  { county: "Wajir", towns: ["Wajir", "Habaswein", "Eldas"] },
  { county: "Mandera", towns: ["Mandera", "Elwak", "Rhamu"] },
  { county: "Marsabit", towns: ["Marsabit", "Moyale", "Loiyangalani"] },
  { county: "Isiolo", towns: ["Isiolo", "Garbatulla", "Merti"] },
  { county: "Meru", towns: ["Meru", "Maua", "Nkubu", "Timau"] },
  { county: "Tharaka Nithi", towns: ["Chuka", "Kathwana", "Chogoria"] },
  { county: "Embu", towns: ["Embu", "Runyenjes", "Siakago"] },
  { county: "Kitui", towns: ["Kitui", "Mwingi", "Mutomo"] },
  { county: "Machakos", towns: ["Machakos", "Athi River", "Tala", "Kangundo"] },
  { county: "Makueni", towns: ["Wote", "Emali", "Makindu", "Kibwezi"] },
  { county: "Nyandarua", towns: ["Ol Kalou", "Engineer", "Njabini"] },
  { county: "Nyeri", towns: ["Nyeri", "Karatina", "Othaya", "Naro Moru"] },
  { county: "Kirinyaga", towns: ["Kerugoya", "Kutus", "Wang’uru", "Sagana"] },
  { county: "Murang’a", towns: ["Murang’a", "Kenol", "Maragwa"] },
  { county: "Kiambu", towns: ["Thika", "Ruiru", "Kiambu", "Kikuyu", "Limuru"] },
  { county: "Turkana", towns: ["Lodwar", "Kakuma", "Lokichogio"] },
  { county: "West Pokot", towns: ["Kapenguria", "Ortum"] },
  { county: "Samburu", towns: ["Maralal", "Baragoi", "Wamba"] },
  { county: "Trans Nzoia", towns: ["Kitale", "Endebess"] },
  { county: "Uasin Gishu", towns: ["Eldoret", "Turbo", "Burnt Forest"] },
  { county: "Elgeyo Marakwet", towns: ["Iten", "Kapsowar", "Tambach"] },
  { county: "Nandi", towns: ["Kapsabet", "Nandi Hills"] },
  { county: "Baringo", towns: ["Kabarnet", "Eldama Ravine", "Marigat"] },
  { county: "Laikipia", towns: ["Nanyuki", "Nyahururu", "Rumuruti"] },
  { county: "Nakuru", towns: ["Nakuru", "Naivasha", "Gilgil", "Molo"] },
  { county: "Narok", towns: ["Narok", "Kilgoris"] },
  { county: "Kajiado", towns: ["Kitengela", "Ngong", "Kajiado", "Rongai"] },
  { county: "Kericho", towns: ["Kericho", "Litein", "Londiani"] },
  { county: "Bomet", towns: ["Bomet", "Sotik", "Longisa"] },
  { county: "Kakamega", towns: ["Kakamega", "Mumias", "Malava"] },
  { county: "Vihiga", towns: ["Mbale", "Luanda", "Chavakali"] },
  { county: "Bungoma", towns: ["Bungoma", "Webuye", "Kimilili"] },
  { county: "Busia", towns: ["Busia", "Malaba", "Bumala"] },
  { county: "Siaya", towns: ["Siaya", "Bondo", "Ugunja"] },
  { county: "Kisumu", towns: ["Kisumu", "Ahero", "Muhoroni"] },
  { county: "Homa Bay", towns: ["Homa Bay", "Mbita", "Oyugis"] },
  { county: "Migori", towns: ["Migori", "Rongo", "Kehancha"] },
  { county: "Kisii", towns: ["Kisii", "Ogembo", "Keroka"] },
  { county: "Nyamira", towns: ["Nyamira", "Keroka", "Nyansiongo"] },
  { county: "Nairobi", towns: ["Nairobi CBD", "Westlands", "Eastleigh", "Kasarani", "Embakasi"] },
] as const;

function getZoneIdForKnownCounty(county: string): ServiceZone {
  const normalized = normalizeKenyaLocationName(county);
  if (zoneOneCounties.has(normalized)) return "ZONE_1";
  if (zoneTwoCounties.has(normalized)) return "ZONE_2";
  return "ZONE_3";
}

export const kenyaCountyMarkets = kenyaCountyMarketEntries.map((entry) => ({
  ...entry,
  zone: getZoneIdForKnownCounty(entry.county),
}));

export const kenyaCountyOptions = kenyaCountyMarkets.map((entry) => entry.county);

export function getTownsForCounty(county: string): string[] {
  const normalizedCounty = normalizeKenyaLocationName(county);
  const match = kenyaCountyMarkets.find((entry) => normalizeKenyaLocationName(entry.county) === normalizedCounty);
  return match ? [...match.towns] : [];
}

export function getServiceZone(county: string | null | undefined, town?: string | null): ServiceZoneConfig | null {
  const normalizedCounty = normalizeKenyaLocationName(county);
  if (!normalizedCounty) return null;
  const market = kenyaCountyMarkets.find((entry) => normalizeKenyaLocationName(entry.county) === normalizedCounty);
  if (!market) return null;
  const normalizedTown = normalizeKenyaLocationName(town);
  if (normalizedTown && !market.towns.some((entryTown) => normalizeKenyaLocationName(entryTown) === normalizedTown)) return null;
  return serviceZoneConfig[market.zone];
}

export function getSiteVisitFee(county: string | null | undefined, town?: string | null) {
  return getServiceZone(county, town)?.siteVisitFee ?? null;
}

export function getDeliveryZone(county: string | null | undefined, town?: string | null) {
  return getServiceZone(county, town);
}
