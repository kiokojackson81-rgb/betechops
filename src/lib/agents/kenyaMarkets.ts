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

export const UNLISTED_TOWN_OPTION = "My town / area is not listed";

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
  { county: "Mombasa", towns: ["Mombasa", "Mombasa CBD", "Nyali", "Bamburi", "Likoni", "Changamwe", "Kisauni", "Miritini", "Mikindani", "Tudor", "Shanzu", "Kongowea", "Buxton"] },
  { county: "Kwale", towns: ["Kwale", "Kwale Town", "Ukunda", "Diani", "Msambweni", "Lunga Lunga", "Kinango", "Samburu", "Tiwi", "Shimoni"] },
  { county: "Kilifi", towns: ["Kilifi", "Malindi", "Mariakani", "Mazeras", "Vipingo", "Watamu", "Mtwapa", "Kaloleni", "Ganze", "Rabai"] },
  { county: "Tana River", towns: ["Hola", "Garsen", "Bura", "Madogo", "Ngao", "Kipini", "Wenje"] },
  { county: "Lamu", towns: ["Lamu", "Lamu Town", "Mpeketoni", "Witu", "Mokowe", "Hindi", "Faza", "Kizingitini"] },
  { county: "Taita Taveta", towns: ["Voi", "Taveta", "Wundanyi", "Mwatate", "Maungu", "Mackinnon Road", "Bura", "Mbololo"] },
  { county: "Garissa", towns: ["Garissa", "Garissa Township", "Dadaab", "Modogashe", "Balambala", "Bura East", "Masalani", "Hulugho"] },
  { county: "Wajir", towns: ["Wajir", "Wajir Town", "Habaswein", "Eldas", "Griftu", "Bute", "Buna", "Tarbaj"] },
  { county: "Mandera", towns: ["Mandera", "Mandera Town", "Elwak", "El Wak", "Rhamu", "Takaba", "Banisa", "Lafey", "Arabia"] },
  { county: "Marsabit", towns: ["Marsabit", "Marsabit Town", "Moyale", "Sololo", "Laisamis", "Loiyangalani", "North Horr", "Maikona"] },
  { county: "Isiolo", towns: ["Isiolo", "Isiolo Town", "Garbatulla", "Merti", "Kinna"] },
  { county: "Meru", towns: ["Meru", "Meru Town", "Maua", "Nkubu", "Timau", "Mikinduri", "Muthara", "Laare", "Kianjai", "Kiirua", "Kangeta", "Kibirichia"] },
  { county: "Tharaka Nithi", towns: ["Chuka", "Chogoria", "Kathwana", "Marimanti", "Chiakariga", "Gatunga", "Maara"] },
  { county: "Embu", towns: ["Embu", "Embu Town", "Kianjokoma", "Kiritiri", "Piai", "Runyenjes", "Siakago", "Manyatta", "Ishiara"] },
  { county: "Kitui", towns: ["Kitui", "Kitui Town", "Mwingi", "Mutomo", "Kabati", "Kwa Vonza", "Migwani", "Kyuso", "Mutitu", "Ikutha", "Zombe", "Tseikuru"] },
  { county: "Machakos", towns: ["Machakos", "Machakos Town", "Athi River", "Mlolongo", "Syokimau", "Katani", "Joska", "Malaa", "Kangundo", "Tala", "Matungulu", "Masii", "Matuu", "Kathiani", "Kalama", "Konza", "Kyumbi"] },
  { county: "Makueni", towns: ["Wote", "Makindu", "Emali", "Sultan Hamud", "Kibwezi", "Mtito Andei", "Nunguni", "Kilome", "Kathonzweni", "Machinery", "Salama"] },
  { county: "Nyandarua", towns: ["Ol Kalou", "Engineer", "Njabini", "Mairo Inya", "Ndaragwa", "Kinangop", "North Kinangop", "Miharati", "Shamata"] },
  { county: "Nyeri", towns: ["Nyeri", "Nyeri Town", "Karatina", "Othaya", "Mukurwe-ini", "Naro Moru", "Chaka", "Kiganjo", "Mweiga", "Endarasha"] },
  { county: "Kirinyaga", towns: ["Kagio", "Kagumo", "Kerugoya", "Kerugoya Town", "Kianyaga", "Kutus", "Makutano", "Mwea", "Wang’uru", "Sagana", "Baricho"] },
  { county: "Murang’a", towns: ["Murang’a", "Murang'a Town", "Kenol", "Maragwa", "Maragua", "Kangema", "Kandara", "Kangari", "Kigumo", "Kiriani", "Kahuro", "Saba Saba", "Makuyu"] },
  { county: "Kiambu", towns: ["Thika", "Thika CBD", "Thika Town", "Ngoigwa", "Banana Hill", "Muchatha", "Cianda", "Ndumberi", "Tingaanga", "Gatundu Town", "Githunguri", "Juja Farm", "Juja", "Highpoint", "Witeithie", "Kabete", "Uthiru", "Kamakis", "Green Spot", "Eastern Bypass", "Kamiti", "Tatu City", "Nova", "Kiambu", "Kiambu Town", "Kirigiti", "Kikuyu", "Gitaru", "Kanyariri", "Muguga", "Kimende", "Kinoo", "Muthiga", "Rugiri", "Nyadhuna", "Limuru", "Makongeni", "Murram", "Croton", "Kimunyu", "Muthaiga", "Ridgeways", "Ndenderu", "Kiambaa", "Karura", "Njomoko", "Gachie", "Kitusuru", "Membley", "Ruiru", "Ruiru Prisons", "Progressive", "Ruaka", "Two Rivers", "Ruiru Town", "Kimbo", "Ruiru-Kihunguro", "Thindigua", "Runda", "Edenville", "Four Ways", "Toll", "Kenyatta Road", "KU Boma", "Wangige", "Zambezi", "Sigona", "Lari", "Kahawa Sukari"] },
  { county: "Turkana", towns: ["Lodwar", "Kakuma", "Lokichogio", "Lokichar", "Lokori", "Kalokol", "Lokitaung", "Kainuk"] },
  { county: "West Pokot", towns: ["Kapenguria", "Makutano", "Chepareria", "Ortum", "Sigor", "Kacheliba", "Alale"] },
  { county: "Samburu", towns: ["Maralal", "Baragoi", "Wamba", "Archers Post", "South Horr", "Suguta Marmar"] },
  { county: "Trans Nzoia", towns: ["Kitale", "Kitale Town", "Kiminini", "Endebess", "Kwanza", "Maili Tisa", "Sibanga", "Saboti", "Matunda", "Moi's Bridge"] },
  { county: "Uasin Gishu", towns: ["Eldoret", "Eldoret CBD", "Annex", "Kapsoya", "Elgon View", "Langas", "Pioneer", "Huruma", "Kimumu", "Maili Nne", "Turbo", "Burnt Forest", "Moiben", "Ziwa", "Soy", "Moi's Bridge"] },
  { county: "Elgeyo Marakwet", towns: ["Iten", "Kapsowar", "Chepkorio", "Tambach", "Flax", "Chebiemit", "Tot", "Chesoi"] },
  { county: "Nandi", towns: ["Kapsabet", "Nandi Hills", "Mosoriot", "Kabiyet", "Lessos", "Kobujoi", "Maraba", "Chepterwai"] },
  { county: "Baringo", towns: ["Eldama Ravine", "Kabarnet", "Kabarnet Town", "Marigat", "Marigat Town", "Mogotio", "Kabartonjo", "Chemolingot", "Mochongoi"] },
  { county: "Laikipia", towns: ["Nanyuki", "Nyahururu", "Rumuruti", "Doldol", "Kinamba", "Naro Moru", "Sipili"] },
  { county: "Nakuru", towns: ["Nakuru", "Nakuru CBD", "Nakuru Town", "Lanet", "Naka", "Pipeline", "Free Area", "Section 58", "London", "Bahati", "Naivasha", "Gilgil", "Mai Mahiu", "Molo", "Njoro", "Rongai", "Salgaa", "Subukia", "Elburgon", "Mau Narok", "Olenguruone"] },
  { county: "Narok", towns: ["Narok", "Narok Town", "Kilgoris", "Suswa", "Ololulunga", "Mulot", "Ewaso Ng'iro", "Lolgorian", "Emurua Dikirr"] },
  { county: "Kajiado", towns: ["Kitengela", "Ngong", "Kajiado", "Kajiado Town", "Rongai", "Ongata Rongai", "Isinya", "Kerarapon", "Bulbul", "Kiserian", "Loitoktok", "Matasia", "Namanga", "Bisil", "Kimana", "Mashuuru"] },
  { county: "Kericho", towns: ["Kericho", "Kericho Town", "Litein", "Londiani", "Kipkelion", "Kapsoit", "Kabianga", "Fort Ternan"] },
  { county: "Bomet", towns: ["Bomet", "Bomet Town", "Mulot", "Sotik", "Longisa", "Kaplong", "Chebole", "Ndanai"] },
  { county: "Kakamega", towns: ["Kakamega", "Kakamega Town", "Butere", "Kambiri Junction", "Kipkaren", "Malava", "Mumias", "Sabatia", "Sigalagala", "Khwisero", "Matungu", "Shinyalu", "Navakholo", "Shianda"] },
  { county: "Vihiga", towns: ["Mbale", "Vihiga", "Luanda", "Majengo", "Chavakali", "Hamisi", "Mudete", "Serem"] },
  { county: "Bungoma", towns: ["Bungoma", "Bungoma Town", "Chwele", "Kamukuywa", "Kimilili", "Webuye", "Malakisi", "Sirisia", "Kanduyi", "Tongaren", "Bumula"] },
  { county: "Busia", towns: ["Busia", "Busia Town", "Malaba", "Malaba Town", "Bumala", "Nambale", "Port Victoria", "Funyula", "Matayos", "Butula", "Amagoro"] },
  { county: "Siaya", towns: ["Siaya", "Siaya Town", "Bondo", "Ugunja", "Ukwala", "Yala", "Usenge", "Sega", "Akala", "Rarieda"] },
  { county: "Kisumu", towns: ["Kisumu", "Kisumu CBD", "Ahero", "Awasi", "Kaloleni", "Nyalenda B", "Railways", "Kicomi", "Pipeline", "Kisumu International Airport", "Bandani", "Brightlight", "Kondele", "Migosi", "Lolwe", "Carwash", "Kibos", "Mamboleo", "Manyatta", "Nyamasaria", "Mowlem", "Maseno", "Muhoroni", "United Mall", "Patel", "Kibuye", "Chemelil", "Katito"] },
  { county: "Homa Bay", towns: ["Homa Bay", "Homa Bay Town", "Kendu Bay", "Mbita", "Ndhiwa", "Oyugis", "Rodi Kopany", "Rangwe", "Sindo", "Kosele"] },
  { county: "Migori", towns: ["Migori", "Migori Town", "Rongo", "Awendo", "Kehancha", "Isebania", "Uriri", "Sori", "Macalder", "Rapogi"] },
  { county: "Kisii", towns: ["Kisii", "Kisii Town", "Keroka", "Ogembo", "Suneka", "Daraja Mbili", "Keumbu", "Tabaka", "Nyamache", "Marani"] },
  { county: "Nyamira", towns: ["Nyamira", "Nyamira Town", "Keroka", "Nyansiongo", "Ekerenyo", "Manga", "Kebirigo", "Rigoma"] },
  { county: "Nairobi", towns: ["Nairobi CBD", "Westlands", "Parklands", "Highridge", "Eastleigh", "Kileleshwa", "Kilimani", "Lavington", "Kawangware", "Gatina", "Hurlingham", "Upper Hill", "Ngong Road", "Adams Arcade", "Dagoretti Corner", "Karen", "Lang'ata", "South B", "South C", "Industrial Area", "Embakasi", "Fedha", "Tassia", "Pipeline", "Utawala", "Donholm", "Kayole", "Komarock", "Umoja", "Tena", "Nasra", "Buruburu", "Hamza", "Harambee", "Kasarani", "Mwiki", "Clay City", "Roysambu", "Zimmerman", "Kahawa West", "Githurai", "Ruaraka", "Baba Dogo", "Lucky Summer", "Mathare", "Survey", "Utalii", "Kangemi", "Lower Kabete", "Uthiru", "Dagoretti", "Riruta", "Waithaka", "Kibera", "Ruai", "Kamulu"] },
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

/** Town choices used by customer checkout. The manual option is intentionally last. */
export function getCheckoutTownsForCounty(county: string): string[] {
  const towns = getTownsForCounty(county);
  return towns.length ? [...towns, UNLISTED_TOWN_OPTION] : [];
}

/** Filters checkout locations without moving the manual option away from the end. */
export function searchCheckoutTowns(county: string, query: string): string[] {
  const normalizedQuery = normalizeKenyaLocationName(query).trim();
  const towns = getTownsForCounty(county);
  const matches = normalizedQuery
    ? towns.filter((town) => normalizeKenyaLocationName(town).includes(normalizedQuery))
    : towns;
  return matches.length || towns.length ? [...matches, UNLISTED_TOWN_OPTION] : [];
}

export function isUnlistedTownSelection(town: string | null | undefined) {
  return normalizeKenyaLocationName(town) === normalizeKenyaLocationName(UNLISTED_TOWN_OPTION);
}

export function isKnownTownForCounty(county: string | null | undefined, town: string | null | undefined) {
  const normalizedCounty = normalizeKenyaLocationName(county);
  const normalizedTown = normalizeKenyaLocationName(town);
  if (!normalizedCounty || !normalizedTown || isUnlistedTownSelection(town)) return false;
  const market = kenyaCountyMarkets.find((entry) => normalizeKenyaLocationName(entry.county) === normalizedCounty);
  return Boolean(market?.towns.some((entryTown) => normalizeKenyaLocationName(entryTown) === normalizedTown));
}

export type CheckoutTownResolution = {
  town: string;
  townSource: "predefined" | "manual";
  zone: ServiceZoneConfig;
};

/** Manual areas inherit the selected county's existing service zone. */
export function resolveCheckoutTown(
  county: string,
  selectedTown: string,
  manualTown?: string | null,
): CheckoutTownResolution | null {
  const town = selectedTown.trim();
  if (isUnlistedTownSelection(town)) {
    const actualTown = manualTown?.trim() ?? "";
    const zone = getServiceZone(county, UNLISTED_TOWN_OPTION);
    return actualTown && zone ? { town: actualTown, townSource: "manual", zone } : null;
  }

  const zone = getServiceZone(county, town);
  return town && zone && isKnownTownForCounty(county, town)
    ? { town, townSource: "predefined", zone }
    : null;
}

export function getServiceZone(county: string | null | undefined, town?: string | null): ServiceZoneConfig | null {
  const normalizedCounty = normalizeKenyaLocationName(county);
  if (!normalizedCounty) return null;
  const market = kenyaCountyMarkets.find((entry) => normalizeKenyaLocationName(entry.county) === normalizedCounty);
  if (!market) return null;
  const normalizedTown = normalizeKenyaLocationName(town);
  if (normalizedTown && !isUnlistedTownSelection(town) && !market.towns.some((entryTown) => normalizeKenyaLocationName(entryTown) === normalizedTown)) return null;
  return serviceZoneConfig[market.zone];
}

export function getSiteVisitFee(county: string | null | undefined, town?: string | null) {
  return getServiceZone(county, town)?.siteVisitFee ?? null;
}

export function getDeliveryZone(county: string | null | undefined, town?: string | null) {
  return getServiceZone(county, town);
}
