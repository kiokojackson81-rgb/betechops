import type { AttendantCategory } from "@prisma/client";

export type AttendantActivityMetric = "DAILY_SALES" | "PRODUCT_UPLOADS" | "ORDER_PROCESSING" | "CUSTOM";

export interface AttendantCategoryDefinition {
  id: AttendantCategory;
  label: string;
  description: string;
  primaryMetrics: AttendantActivityMetric[];
  defaultWidgets: ("QUEUE" | "PRICING" | "RETURNS" | "DAILY_SALES" | "PRODUCT_UPLOADS" | "ANNOUNCEMENTS" | "SHORTCUTS" | "SHOP_SNAPSHOT")[];
  highlight: string;
}

export const ATTENDANT_ACTIVITY_METRICS: Record<AttendantActivityMetric, AttendantActivityMetric> = {
  DAILY_SALES: "DAILY_SALES",
  PRODUCT_UPLOADS: "PRODUCT_UPLOADS",
  ORDER_PROCESSING: "ORDER_PROCESSING",
  CUSTOM: "CUSTOM",
};

export const attendantCategories: AttendantCategoryDefinition[] = [
  {
    id: "GENERAL",
    label: "General Attendant",
    description: "Default experience with queue, pricing, returns and announcements.",
    primaryMetrics: ["ORDER_PROCESSING"],
    defaultWidgets: ["QUEUE", "PRICING", "RETURNS", "SHOP_SNAPSHOT", "SHORTCUTS", "ANNOUNCEMENTS"],
    highlight: "slate",
  },
  {
    id: "DIRECT_SALES",
    label: "Direct Sales",
    description: "Track over-the-counter sales and submit daily sales totals.",
    primaryMetrics: ["DAILY_SALES"],
    defaultWidgets: ["DAILY_SALES", "SHOP_SNAPSHOT", "ANNOUNCEMENTS", "SHORTCUTS"],
    highlight: "emerald",
  },
  {
    id: "JUMIA_OPERATIONS",
    label: "Jumia Operations",
    description: "Focus on Jumia order queues, pricing, returns and commission tracking.",
    primaryMetrics: ["ORDER_PROCESSING"],
    defaultWidgets: ["QUEUE", "PRICING", "RETURNS", "SHOP_SNAPSHOT", "ANNOUNCEMENTS"],
    highlight: "orange",
  },
  {
    id: "KILIMALL_OPERATIONS",
    label: "Kilimall Operations",
    description: "Process Kilimall orders, manage returns and monitor synchronization status.",
    primaryMetrics: ["ORDER_PROCESSING"],
    defaultWidgets: ["QUEUE", "RETURNS", "SHOP_SNAPSHOT", "ANNOUNCEMENTS"],
    highlight: "violet",
  },
  {
    id: "PRODUCT_UPLOAD",
    label: "Product Upload",
    description: "Capture catalogue upload counts and monitor listing quality.",
    primaryMetrics: ["PRODUCT_UPLOADS"],
    defaultWidgets: ["PRODUCT_UPLOADS", "ANNOUNCEMENTS", "SHORTCUTS"],
    highlight: "cyan",
  },
  {
    id: "SUPPORT",
    label: "Support",
    description: "Assist with reconciliations and issue triage across platforms.",
    primaryMetrics: ["CUSTOM"],
    defaultWidgets: ["RETURNS", "ANNOUNCEMENTS", "SHORTCUTS"],
    highlight: "amber",
  },
];

export const attendantCategoryById = attendantCategories.reduce<Record<AttendantCategory, AttendantCategoryDefinition>>((acc, def) => {
  acc[def.id] = def;
  return acc;
}, {} as Record<AttendantCategory, AttendantCategoryDefinition>);

export const attendantCategoryOptions = attendantCategories.map((c) => ({
  id: c.id,
  label: c.label,
  description: c.description,
}));

export function getCategoryDefinition(category: AttendantCategory | null | undefined): AttendantCategoryDefinition {
  if (!category) return attendantCategoryById.GENERAL;
  return attendantCategoryById[category] ?? attendantCategoryById.GENERAL;
}
