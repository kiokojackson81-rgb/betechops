"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeUploadProgress = computeUploadProgress;
function computeUploadProgress(marketDay, target) {
    const m = marketDay || {};
    const toNumber = (v) => {
        if (v === undefined || v === null || v === "")
            return 0;
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };
    const uploadsToday = toNumber(m.newUploaded) + toNumber(m.copiesUploaded) + toNumber(m.productsEdited);
    const pct = target > 0 ? Math.round((uploadsToday / target) * 100) : 0;
    return { uploadsToday, pct };
}
