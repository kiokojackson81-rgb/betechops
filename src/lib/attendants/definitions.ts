import type { AttendantCategory } from "@prisma/client";

export type AttendantActivityMetric = "DAILY_SALES" | "PRODUCT_UPLOADS" | "ORDER_PROCESSING" | "CUSTOM";

export interface AttendantCategoryDefinition {
  id: string;
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

export const attendantCategoryDefinitions: AttendantCategoryDefinition[] = [
  {
    id: "DIRECT_SALES_OPS",
    label: "Direct Sales Ops",
    description: "Frontline sales tracking and marketing receipts.",
    primaryMetrics: ["DAILY_SALES"],
    defaultWidgets: ["DAILY_SALES", "SHOP_SNAPSHOT", "ANNOUNCEMENTS", "SHORTCUTS"],
    highlight: "emerald",
  },
  {
    id: "MARKETING_OPS",
    label: "Marketing Ops",
    description: "Marketing content, uploads, and creative day planning.",
    primaryMetrics: ["PRODUCT_UPLOADS", "DAILY_SALES"],
    defaultWidgets: ["PRODUCT_UPLOADS", "DAILY_SALES", "ANNOUNCEMENTS", "SHORTCUTS"],
    highlight: "cyan",
  },
  {
    id: "SUPPORT_OPS",
    label: "Support Ops",
    description: "Support tickets, reconciliation, and issue triage.",
    primaryMetrics: ["CUSTOM"],
    defaultWidgets: ["RETURNS", "ANNOUNCEMENTS", "SHORTCUTS"],
    highlight: "amber",
  },
  {
    id: "JUMIA_KILIMALL_OPS",
    label: "Jumia / Kilimall Ops",
    description: "Marketplace operations for Jumia and Kilimall.",
    primaryMetrics: ["ORDER_PROCESSING"],
    defaultWidgets: ["QUEUE", "PRICING", "RETURNS", "SHOP_SNAPSHOT", "ANNOUNCEMENTS"],
    highlight: "orange",
  },
  {
    id: "BETECH_OPS",
    label: "Betech Operations",
    description: "Backend operations and general oversight.",
    primaryMetrics: ["CUSTOM"],
    defaultWidgets: ["QUEUE", "PRICING", "RETURNS", "ANNOUNCEMENTS", "SHORTCUTS"],
    highlight: "slate",
  },
];

export const attendantCategoryById = attendantCategoryDefinitions.reduce<Record<string, AttendantCategoryDefinition>>((acc, def) => {
  acc[def.id] = def;
  return acc;
}, {} as Record<string, AttendantCategoryDefinition>);

export const attendantCategoryOptions = attendantCategoryDefinitions.map((def) => ({
  id: def.id,
  label: def.label,
  description: def.description,
}));

export function getCategoryDefinition(category: AttendantCategory | null | undefined): AttendantCategoryDefinition {
  if (!category) return (attendantCategoryById as any)["DIRECT_SALES_OPS"];
  return (attendantCategoryById as any)[category as any] ?? (attendantCategoryById as any)["DIRECT_SALES_OPS"];
}
