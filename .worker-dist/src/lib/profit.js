"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeProfit = computeProfit;
const toNum = (v) => Number(v);
const sum = (a) => a.reduce((t, x) => t + toNum(x), 0);
function computeProfit(inputs) {
    const revenue = toNum(inputs.sellPrice) * inputs.qty;
    const fees = sum(inputs.settlement.commission) + sum(inputs.settlement.penalty);
    const shipping = sum(inputs.settlement.shipping_fee);
    const refunds = sum(inputs.settlement.refund);
    const unitCost = toNum(inputs.unitCost);
    const profit = revenue - unitCost * inputs.qty - fees - shipping + refunds;
    return { revenue, fees, shipping, refunds, unitCost, qty: inputs.qty, profit };
}
