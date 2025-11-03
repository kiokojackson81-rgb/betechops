"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isActive = isActive;
exports.pickRule = pickRule;
exports.computeCommission = computeCommission;
exports.reverseCommission = reverseCommission;
function isActive(rule, at) {
    const fromOk = rule.effectiveFrom <= at;
    const toOk = !rule.effectiveTo || at <= rule.effectiveTo;
    return fromOk && toOk;
}
function pickRule(rules, basis) {
    const active = rules.filter((r) => isActive(r, basis.at));
    // priority sku > category > shop > global
    const bySku = active.find((r) => r.scope === "sku" && r.sku === basis.sku);
    if (bySku)
        return bySku;
    const byCat = active.find((r) => r.scope === "category" && r.category && r.category === basis.category);
    if (byCat)
        return byCat;
    const byShop = active.find((r) => r.scope === "shop" && r.shopId && r.shopId === basis.shopId);
    if (byShop)
        return byShop;
    return active.find((r) => r.scope === "global");
}
function computeCommission(rule, basis) {
    const detail = { ruleId: rule.id, type: rule.type, rate: rule.rateDecimal };
    let amount = 0;
    switch (rule.type) {
        case "percent_profit":
            amount = basis.profit * rule.rateDecimal;
            break;
        case "percent_gross":
            amount = basis.revenue * rule.rateDecimal;
            break;
        case "flat_per_item":
            amount = rule.rateDecimal * basis.qty; // interpret rateDecimal as flat KES
            break;
    }
    return { amount, detail };
}
function reverseCommission(amount) {
    return -Math.abs(amount);
}
