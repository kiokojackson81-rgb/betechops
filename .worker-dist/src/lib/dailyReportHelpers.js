"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeRowStatus = computeRowStatus;
// Determine completeness status for a report's marketplaceReview
function computeRowStatus(r) {
    const mr = r.tasks?.marketplaceReview ?? {};
    const shops = Object.keys(mr || {});
    if (!shops || shops.length === 0)
        return 'missing';
    let anyDone = false;
    let allComplete = true;
    for (const k of shops) {
        const s = mr[k] || {};
        const checks = [s.stockChecked, s.pricingConfirmed, s.competitorsReviewed, s.oosReviewed];
        const done = checks.filter(Boolean).length;
        if (done > 0)
            anyDone = true;
        if (done < 4)
            allComplete = false;
    }
    if (allComplete)
        return 'complete';
    if (anyDone)
        return 'partial';
    return 'missing';
}
