"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendantCategoryOptions = exports.attendantCategoryById = exports.attendantCategoryDefinitions = exports.ATTENDANT_ACTIVITY_METRICS = void 0;
exports.getCategoryDefinition = getCategoryDefinition;
exports.ATTENDANT_ACTIVITY_METRICS = {
    DAILY_SALES: "DAILY_SALES",
    PRODUCT_UPLOADS: "PRODUCT_UPLOADS",
    ORDER_PROCESSING: "ORDER_PROCESSING",
    CUSTOM: "CUSTOM",
};
exports.attendantCategoryDefinitions = [
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
exports.attendantCategoryById = exports.attendantCategoryDefinitions.reduce((acc, def) => {
    acc[def.id] = def;
    return acc;
}, {});
exports.attendantCategoryOptions = exports.attendantCategoryDefinitions.map((def) => ({
    id: def.id,
    label: def.label,
    description: def.description,
}));
function getCategoryDefinition(category) {
    if (!category)
        return exports.attendantCategoryById["DIRECT_SALES_OPS"];
    return exports.attendantCategoryById[category] ?? exports.attendantCategoryById["DIRECT_SALES_OPS"];
}
