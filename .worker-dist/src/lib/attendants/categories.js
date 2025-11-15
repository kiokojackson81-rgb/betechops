"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendantCategoryOptions = exports.attendantCategoryById = exports.attendantCategories = exports.ATTENDANT_ACTIVITY_METRICS = void 0;
exports.getCategoryDefinition = getCategoryDefinition;
exports.ATTENDANT_ACTIVITY_METRICS = {
    DAILY_SALES: "DAILY_SALES",
    PRODUCT_UPLOADS: "PRODUCT_UPLOADS",
    ORDER_PROCESSING: "ORDER_PROCESSING",
    CUSTOM: "CUSTOM",
};
exports.attendantCategories = [
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
exports.attendantCategoryById = exports.attendantCategories.reduce((acc, def) => {
    acc[def.id] = def;
    return acc;
}, {});
exports.attendantCategoryOptions = exports.attendantCategories.map((c) => ({
    id: c.id,
    label: c.label,
    description: c.description,
}));
function getCategoryDefinition(category) {
    if (!category)
        return exports.attendantCategoryById.GENERAL;
    return exports.attendantCategoryById[category] ?? exports.attendantCategoryById.GENERAL;
}
