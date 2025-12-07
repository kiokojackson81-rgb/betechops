"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplaceAssignmentRoleValues = exports.MarketplaceAssignmentRole = void 0;
exports.isMarketplaceAssignmentRole = isMarketplaceAssignmentRole;
exports.MarketplaceAssignmentRole = {
    JUMIA_KILIMALL_OPS: "JUMIA_KILIMALL_OPS",
    SUPERVISOR: "SUPERVISOR",
};
exports.MarketplaceAssignmentRoleValues = Object.values(exports.MarketplaceAssignmentRole);
function isMarketplaceAssignmentRole(v) {
    return typeof v === "string" && exports.MarketplaceAssignmentRoleValues.includes(v);
}
exports.default = exports.MarketplaceAssignmentRole;
