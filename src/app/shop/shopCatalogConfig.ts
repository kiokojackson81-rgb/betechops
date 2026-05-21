export const SHOP_CATEGORY_OPTIONS = [
  { value: "solar-panels", label: "Solar Panels" },
  { value: "solar-inverters", label: "Solar Inverters" },
  { value: "solar-batteries", label: "Solar Batteries" },
  { value: "lithium-batteries", label: "Lithium Batteries" },
  { value: "solar-full-kits", label: "Solar Full Kits" },
  { value: "all-in-one-systems", label: "All-in-One Systems" },
  { value: "solar-water-heaters", label: "Solar Water Heaters" },
  { value: "solar-water-pumps", label: "Solar Water Pumps" },
  { value: "solar-lights", label: "Solar Lights" },
  { value: "accessories", label: "Accessories" },
] as const;

export type ShopCategoryOptionValue = (typeof SHOP_CATEGORY_OPTIONS)[number]["value"];
