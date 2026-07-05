export type LoadEstimateQueryType = "single_product" | "category_list" | "need_based_recommendation" | "unclear";

export type AiNeedEstimate = {
  runningLoadWatts: number;
  dailyEnergyWh: number;
  dailyEnergyKWh: number;
  recommendedSearchQuery: string;
  recommendationClass: string;
  assumptions: string[];
  detectedAppliances: string[];
  needsSizing: boolean;
  needsMoreInfo: boolean;
  questionsToAsk: string[];
  recommendedSystemSize: string | null;
  recommendedBatteryKWh: number | null;
  recommendedPanelWatts: number | null;
};

type ApplianceEstimate = {
  key: string;
  runningWatts: number;
  dailyEnergyWh: number;
  assumptions: string[];
  detectedLabel: string;
};

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/([0-9])([a-z])/gi, "$1 $2")
    .replace(/([a-z])([0-9])/gi, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirstNumber(pattern: RegExp, input: string) {
  const match = input.match(pattern);
  const value = Number(match?.[1] ?? "");
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getExplicitHours(query: string) {
  return extractFirstNumber(/(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr)\b/i, query);
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function roundNumber(value: number) {
  return Math.round(value);
}

function roundToSingleDecimal(value: number) {
  return Number(value.toFixed(1));
}

function isVagueSolarSizingRequest(normalized: string) {
  return includesAny(normalized, [
    "solar for ",
    "3 bedroom",
    "4 bedroom",
    "bedroom house",
    "for my home",
    "for home",
    "for business",
    "for shop",
    "backup only",
    "full time solar",
    "power my home",
    "home solar",
    "business solar",
    "i need solar",
    "want solar",
  ]);
}

function buildSizingQuestions(query: string) {
  const normalized = normalizeText(query);
  const questions = [
    "Is this backup only or full-time solar?",
    "Which appliances do you want to power?",
    "How many lights do you have?",
    "Do you have a fridge, freezer, washing machine, microwave, pump, or iron box?",
    "What location is the installation site?",
    "Do you have a budget range in mind?",
  ];

  if (includesAny(normalized, ["lights", "bulbs", "tv", "fridge", "freezer", "router", "wifi", "starlink", "pump"])) {
    return questions.filter((question) => !question.startsWith("Which appliances"));
  }

  return questions;
}

function deriveSystemSizing(dailyEnergyWh: number, runningLoadWatts: number) {
  const dailyEnergyKWh = Number((dailyEnergyWh / 1000).toFixed(2));
  const batteryKWh = roundToSingleDecimal(Math.max(1, dailyEnergyKWh * 1.25));
  const panelWatts = Math.max(200, Math.ceil((dailyEnergyWh / 4.5) / 100) * 100);

  let recommendedSystemSize = "1KW";
  if (runningLoadWatts > 4500 || dailyEnergyWh > 9000) {
    recommendedSystemSize = "8KW";
  } else if (runningLoadWatts > 3200 || dailyEnergyWh > 6500) {
    recommendedSystemSize = "5KW";
  } else if (runningLoadWatts > 1800 || dailyEnergyWh > 3500) {
    recommendedSystemSize = "3KW";
  } else if (runningLoadWatts > 900 || dailyEnergyWh > 1800) {
    recommendedSystemSize = "2KW";
  }

  return {
    dailyEnergyKWh,
    recommendedSystemSize,
    recommendedBatteryKWh: batteryKWh,
    recommendedPanelWatts: panelWatts,
  };
}

function buildBulbEstimate(query: string, normalized: string): ApplianceEstimate | null {
  if (!includesAny(normalized, ["bulb", "bulbs", "light", "lights"])) return null;
  const count =
    extractFirstNumber(/(\d+)\s*(?:led\s*)?(?:bulbs?|lights?)\b/i, query) ??
    (includesAny(normalized, ["bulb", "bulbs", "light", "lights"]) ? 5 : null);
  if (!count) return null;

  const hours = getExplicitHours(query) ?? 5;
  return {
    key: "bulbs",
    runningWatts: count * 10,
    dailyEnergyWh: count * 10 * hours,
    assumptions: [
      "LED bulbs assumed at 10W each",
      `Lighting usage assumed at ${hours} hours per day`,
    ],
    detectedLabel: `${count} bulbs`,
  };
}

function buildTvEstimate(query: string, normalized: string): ApplianceEstimate | null {
  if (!includesAny(normalized, [" tv ", "tv", "television"])) return null;
  const size = extractFirstNumber(/(\d+)\s*(?:inch|in)\s*tv/i, query);
  const hours = getExplicitHours(query) ?? 5;
  let watts = 50;
  let label = "32 inch TV";
  if (size && size >= 55) {
    watts = 120;
    label = `${size} inch TV`;
  } else if (size && size >= 43) {
    watts = 80;
    label = `${size} inch TV`;
  } else if (size) {
    watts = 50;
    label = `${size} inch TV`;
  }

  return {
    key: "tv",
    runningWatts: watts,
    dailyEnergyWh: watts * hours,
    assumptions: [`${label} assumed at ${watts}W for ${hours} hours per day`],
    detectedLabel: label,
  };
}

function buildSimpleEstimate(
  normalized: string,
  query: string,
  key: string,
  aliases: string[],
  watts: number,
  hours: number,
  label: string,
  assumption: string,
) {
  if (!includesAny(normalized, aliases)) return null;
  return {
    key,
    runningWatts: watts,
    dailyEnergyWh: watts * (getExplicitHours(query) ?? hours),
    assumptions: [assumption.replace("{hours}", String(getExplicitHours(query) ?? hours))],
    detectedLabel: label,
  } satisfies ApplianceEstimate;
}

function buildFridgeEstimate(normalized: string): ApplianceEstimate | null {
  if (!normalized.includes("fridge")) return null;
  const doubleDoor = includesAny(normalized, ["double door fridge", "double fridge"]);
  return {
    key: "fridge",
    runningWatts: doubleDoor ? 250 : 150,
    dailyEnergyWh: doubleDoor ? 1800 : 1200,
    assumptions: [doubleDoor ? "Double door fridge assumed at 1.8kWh/day" : "Single door fridge assumed at 1.2kWh/day"],
    detectedLabel: doubleDoor ? "double door fridge" : "single door fridge",
  };
}

function buildFreezerEstimate(normalized: string): ApplianceEstimate | null {
  if (!normalized.includes("freezer")) return null;
  const large = includesAny(normalized, ["large freezer", "big freezer"]);
  return {
    key: "freezer",
    runningWatts: large ? 350 : 200,
    dailyEnergyWh: large ? 2500 : 1600,
    assumptions: [large ? "Large freezer assumed at 2.5kWh/day" : "Small freezer assumed at 1.6kWh/day"],
    detectedLabel: large ? "large freezer" : "small freezer",
  };
}

function buildPumpEstimate(query: string, normalized: string): ApplianceEstimate | null {
  if (!includesAny(normalized, ["pump", "borehole"])) return null;
  const hours = getExplicitHours(query) ?? 1;
  return {
    key: "pump",
    runningWatts: 750,
    dailyEnergyWh: 750 * hours,
    assumptions: ["Small water pump assumed at 750W", `Pump usage assumed at ${hours} hour(s) per day unless confirmed`],
    detectedLabel: "water pump",
  };
}

export function estimateNeedBasedLoad(rawQuery: string): AiNeedEstimate | null {
  const query = String(rawQuery || "").trim();
  const normalized = ` ${normalizeText(query)} `;
  const estimates: ApplianceEstimate[] = [];
  const vagueSizingRequest = isVagueSolarSizingRequest(normalized);

  const bulbEstimate = buildBulbEstimate(query, normalized);
  if (bulbEstimate) estimates.push(bulbEstimate);

  const tvEstimate = buildTvEstimate(query, normalized);
  if (tvEstimate) estimates.push(tvEstimate);

  const decoder = buildSimpleEstimate(
    normalized,
    query,
    "decoder",
    ["decoder"],
    25,
    5,
    "decoder",
    "Decoder assumed at 25W for {hours} hours per day",
  );
  if (decoder) estimates.push(decoder);

  const router = buildSimpleEstimate(
    normalized,
    query,
    "router",
    ["wifi router", "router", "wifi", "wi fi"],
    15,
    8,
    "WiFi router",
    "WiFi router assumed at 15W for {hours} hours per day",
  );
  if (router) estimates.push(router);

  if (includesAny(normalized, ["starlink"])) {
    const hours = getExplicitHours(query) ?? 24;
    estimates.push({
      key: "starlink",
      runningWatts: 75,
      dailyEnergyWh: 75 * hours,
      assumptions: [
        "Starlink assumed at 75W average",
        hours === 24 ? "Starlink usage assumed at 24 hours per day unless backup-only is stated" : `Starlink usage assumed at ${hours} hours per day`,
      ],
      detectedLabel: "Starlink",
    });
  }

  if (includesAny(normalized, ["phone charging", "phone charge", "phones"])) {
    const count = extractFirstNumber(/(\d+)\s*(?:phones?|phone)\b/i, query) ?? 1;
    estimates.push({
      key: "phones",
      runningWatts: count * 10,
      dailyEnergyWh: count * 10 * 3,
      assumptions: [`Phone charging assumed at 10W per phone for 3 hours (${count} phone(s))`],
      detectedLabel: `${count} phone charging`,
    });
  }

  const laptop = buildSimpleEstimate(
    normalized,
    query,
    "laptop",
    ["laptop"],
    60,
    4,
    "laptop",
    "Laptop assumed at 60W for {hours} hours per day",
  );
  if (laptop) estimates.push(laptop);

  const fan = buildSimpleEstimate(
    normalized,
    query,
    "fan",
    ["fan"],
    75,
    6,
    "fan",
    "Fan assumed at 75W for {hours} hours per day",
  );
  if (fan) estimates.push(fan);

  const fridge = buildFridgeEstimate(normalized);
  if (fridge) estimates.push(fridge);

  const freezer = buildFreezerEstimate(normalized);
  if (freezer) estimates.push(freezer);

  const washingMachine = buildSimpleEstimate(
    normalized,
    query,
    "washing_machine",
    ["washing machine"],
    500,
    1,
    "washing machine",
    "Washing machine assumed at 500W for {hours} hour per day",
  );
  if (washingMachine) estimates.push(washingMachine);

  const microwave = buildSimpleEstimate(
    normalized,
    query,
    "microwave",
    ["microwave"],
    1200,
    0.5,
    "microwave",
    "Microwave assumed at 1200W for {hours} hour per day",
  );
  if (microwave) estimates.push(microwave);

  const ironBox = buildSimpleEstimate(
    normalized,
    query,
    "iron_box",
    ["iron box", "iron"],
    1000,
    0.5,
    "iron box",
    "Iron box assumed at 1000W for {hours} hour per day",
  );
  if (ironBox) estimates.push(ironBox);

  const pump = buildPumpEstimate(query, normalized);
  if (pump) estimates.push(pump);

  const cctv = buildSimpleEstimate(
    normalized,
    query,
    "cctv",
    ["cctv"],
    40,
    24,
    "CCTV",
    "CCTV assumed at 40W for {hours} hours per day",
  );
  if (cctv) estimates.push(cctv);

  const electricFence = buildSimpleEstimate(
    normalized,
    query,
    "electric_fence",
    ["electric fence"],
    30,
    24,
    "electric fence",
    "Electric fence assumed at 30W for {hours} hours per day",
  );
  if (electricFence) estimates.push(electricFence);

  if (!estimates.length) {
    if (!vagueSizingRequest) return null;
    return {
      runningLoadWatts: 0,
      dailyEnergyWh: 0,
      dailyEnergyKWh: 0,
      recommendedSearchQuery: "",
      recommendationClass: "needs_more_info",
      assumptions: ["Home or business solar sizing needs appliance details before a final system can be recommended."],
      detectedAppliances: [],
      needsSizing: false,
      needsMoreInfo: true,
      questionsToAsk: buildSizingQuestions(query),
      recommendedSystemSize: null,
      recommendedBatteryKWh: null,
      recommendedPanelWatts: null,
    };
  }

  const runningLoadWatts = roundNumber(estimates.reduce((sum, item) => sum + item.runningWatts, 0));
  const dailyEnergyWh = roundNumber(estimates.reduce((sum, item) => sum + item.dailyEnergyWh, 0));
  const assumptions = Array.from(new Set(estimates.flatMap((item) => item.assumptions)));
  const detectedAppliances = Array.from(new Set(estimates.map((item) => item.detectedLabel)));
  const hasFridge = estimates.some((item) => item.key === "fridge");
  const hasFreezer = estimates.some((item) => item.key === "freezer");
  const hasWashingMachine = estimates.some((item) => item.key === "washing_machine");
  const hasPump = estimates.some((item) => item.key === "pump");
  const hasMicrowave = estimates.some((item) => item.key === "microwave");

  let recommendedSearchQuery = "100W solar full kit";
  let recommendationClass = "starter_100w";
  let needsSizing = false;
  let needsMoreInfo = false;
  let questionsToAsk: string[] = [];

  if (hasPump || normalized.includes("full house") || (hasMicrowave && hasFridge && hasPump)) {
    recommendedSearchQuery = "";
    recommendationClass = "system_quote";
    needsSizing = true;
    needsMoreInfo = true;
    questionsToAsk = buildSizingQuestions(query);
    assumptions.push("Heavy-duty or pump-based request should be sized by a human solar specialist");
  } else if (hasFridge && (hasFreezer || hasWashingMachine)) {
    recommendedSearchQuery = "5KW lithium solar kit";
    recommendationClass = "lithium_5kw";
  } else if (hasFridge) {
    recommendedSearchQuery = "3KW lithium solar kit";
    recommendationClass = "lithium_3kw";
  } else if (runningLoadWatts <= 60 && dailyEnergyWh <= 300) {
    recommendedSearchQuery = "100W solar full kit";
    recommendationClass = "starter_100w";
  } else if (runningLoadWatts <= 120 && dailyEnergyWh <= 600) {
    recommendedSearchQuery = "150W solar full kit";
    recommendationClass = "starter_150w";
  } else if (runningLoadWatts <= 200 && dailyEnergyWh <= 900) {
    recommendedSearchQuery = "200W solar full kit";
    recommendationClass = "starter_200w";
  } else if (runningLoadWatts <= 300 && dailyEnergyWh <= 1200) {
    recommendedSearchQuery = "300W solar full kit";
    recommendationClass = "starter_300w";
  } else if (dailyEnergyWh <= 1800) {
    recommendedSearchQuery = "1KW lithium solar kit";
    recommendationClass = "lithium_1kw";
  } else if (dailyEnergyWh <= 3000) {
    recommendedSearchQuery = "2KW lithium solar kit";
    recommendationClass = "lithium_2kw";
  } else {
    recommendedSearchQuery = "5KW lithium solar kit";
    recommendationClass = "lithium_5kw";
  }

  if (vagueSizingRequest && detectedAppliances.length < 2) {
    needsMoreInfo = true;
    questionsToAsk = buildSizingQuestions(query);
    assumptions.push("A final home or business system size still depends on the appliances and whether the customer wants backup-only or full-time solar.");
  }

  const derivedSizing = deriveSystemSizing(dailyEnergyWh, runningLoadWatts);

  console.info("[AI need estimate]", {
    rawQuery: query,
    detectedAppliances,
    runningLoadWatts,
    dailyEnergyWh,
    dailyEnergyKWh: derivedSizing.dailyEnergyKWh,
    recommendedSearchQuery,
    recommendedSystemSize: derivedSizing.recommendedSystemSize,
    recommendedBatteryKWh: derivedSizing.recommendedBatteryKWh,
    recommendedPanelWatts: derivedSizing.recommendedPanelWatts,
    needsMoreInfo,
  });

  return {
    runningLoadWatts,
    dailyEnergyWh,
    dailyEnergyKWh: derivedSizing.dailyEnergyKWh,
    recommendedSearchQuery,
    recommendationClass,
    assumptions,
    detectedAppliances,
    needsSizing,
    needsMoreInfo,
    questionsToAsk,
    recommendedSystemSize: derivedSizing.recommendedSystemSize,
    recommendedBatteryKWh: derivedSizing.recommendedBatteryKWh,
    recommendedPanelWatts: derivedSizing.recommendedPanelWatts,
  };
}
