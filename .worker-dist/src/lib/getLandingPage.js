"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLandingPage = getLandingPage;
exports.getAdminLandingPage = getAdminLandingPage;
exports.getCategoryLabel = getCategoryLabel;
const categoryCompat_1 = require("@/lib/attendants/categoryCompat");
function getLandingPage(category, role) {
    if (role === "ADMIN")
        return "/admin";
    const cat = (0, categoryCompat_1.normalizeCategory)(category);
    if (!cat)
        return "/attendant";
    switch (cat) {
        case "DIRECT_SALES_OPS":
            return "/marketing/tracker";
        case "MARKETING_OPS":
            return "/attendant/daily-report";
        case "JUMIA_KILIMALL_OPS":
            return "/attendant";
        case "SUPPORT_OPS":
            return "/attendant/support";
        case "BETECH_OPS":
            return role === "ADMIN" ? "/admin" : "/attendant";
        default:
            return "/attendant";
    }
}
function getAdminLandingPage(category, role) {
    if (role === "ADMIN")
        return "/admin";
    const cat = (0, categoryCompat_1.normalizeCategory)(category);
    if (!cat)
        return "/admin";
    switch (cat) {
        case "DIRECT_SALES_OPS":
            return "/admin/marketing-report";
        case "MARKETING_OPS":
            return "/admin/daily-report";
        case "JUMIA_KILIMALL_OPS":
            return "/admin/jumia-console";
        case "SUPPORT_OPS":
            return "/admin/support-report";
        case "BETECH_OPS":
            return "/admin";
        default:
            return "/admin";
    }
}
function getCategoryLabel(category) {
    switch (category) {
        case "DIRECT_SALES_OPS":
            return "Direct Sales Ops";
        case "MARKETING_OPS":
            return "Marketing Ops";
        case "JUMIA_KILIMALL_OPS":
            return "Jumia / Kilimall Ops";
        case "SUPPORT_OPS":
            return "Support Ops";
        case "BETECH_OPS":
            return "Betech Ops (Supervisor)";
        default:
            return "Unassigned";
    }
}
exports.default = getLandingPage;
