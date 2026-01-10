"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chooseAuthoritativeCandidate = chooseAuthoritativeCandidate;
exports.ensureCanonicalWeekStart = ensureCanonicalWeekStart;
const weekWindow_1 = require("./weekWindow");
const statementStatus_1 = require("./statementStatus");
const STATUS_PRIORITY = {
    PAID: 3,
    OPEN: 2,
    UNPAID: 1,
};
function toNumericValue(value) {
    if (typeof value === "number")
        return value;
    if (value && typeof value.toNumber === "function") {
        return value.toNumber();
    }
    if (value && typeof value.toString === "function") {
        const parsed = Number(value.toString());
        if (!Number.isNaN(parsed))
            return parsed;
    }
    return 0;
}
function payoutFieldValue(row) {
    if (row.payoutAmount !== undefined && row.payoutAmount !== null)
        return toNumericValue(row.payoutAmount);
    if (row.grossSales !== undefined && row.grossSales !== null)
        return toNumericValue(row.grossSales);
    return 0;
}
function grossFieldValue(row) {
    if (row.grossSales !== undefined && row.grossSales !== null)
        return toNumericValue(row.grossSales);
    if (row.payoutAmount !== undefined && row.payoutAmount !== null)
        return toNumericValue(row.payoutAmount);
    return 0;
}
function normalizedStatementNumber(row) {
    return String(row.statementNumber ?? "").toUpperCase();
}
function hasStatementSuffix(row) {
    return /(OPEN|PAID|UNPAID)$/.test(normalizedStatementNumber(row));
}
function isPlaceholder(row) {
    return Boolean(row.rawPayload?.placeholder === true);
}
function isAuto(row) {
    return normalizedStatementNumber(row).startsWith("AUTO:");
}
function getUpdatedTimestamp(row) {
    const payloadUpdated = row.rawPayload?.updatedAt ?? row.rawPayload?.createdAt;
    if (payloadUpdated) {
        const d = new Date(payloadUpdated);
        if (!Number.isNaN(d.getTime()))
            return d.getTime();
    }
    return row.updatedAt?.getTime() ?? row.createdAt?.getTime() ?? 0;
}
function chooseAuthoritativeCandidate(rows, canonicalWeekStart) {
    if (!rows?.length)
        return null;
    const realRows = rows.filter((r) => !isPlaceholder(r));
    const pool = realRows.length ? realRows : rows;
    let best = null;
    const canonicalStartMs = canonicalWeekStart.getTime();
    const rank = (row) => {
        const periodStart = (0, weekWindow_1.parseDateOnlyUtc)(row.rawPayload?.period?.startDate ?? null);
        const periodMatch = periodStart &&
            (0, weekWindow_1.canonicalNairobiWeekStartUtc)(periodStart).getTime() === canonicalStartMs
            ? 1
            : 0;
        const statusLabel = (0, statementStatus_1.deriveStatementStatus)(row.statementNumber, row.isPaid).label;
        const statusRank = STATUS_PRIORITY[statusLabel] ?? 0;
        const updatedScore = getUpdatedTimestamp(row);
        const payoutValue = payoutFieldValue(row);
        const rowStart = (0, weekWindow_1.canonicalNairobiWeekStartUtc)(new Date(row.weekStart ?? canonicalWeekStart));
        const diff = Math.abs(rowStart.getTime() - canonicalStartMs);
        return {
            periodMatch,
            statusRank,
            updatedScore,
            diff,
            payoutValue,
            suffixBonus: hasStatementSuffix(row) ? 1 : 0,
            autoPenalty: isAuto(row) ? 1 : 0,
        };
    };
    for (const row of pool) {
        if (!best) {
            best = row;
            continue;
        }
        const current = rank(row);
        const bestRank = rank(best);
        if (current.periodMatch !== bestRank.periodMatch) {
            if (current.periodMatch > bestRank.periodMatch)
                best = row;
            continue;
        }
        if (current.statusRank !== bestRank.statusRank) {
            if (current.statusRank > bestRank.statusRank)
                best = row;
            continue;
        }
        if (current.updatedScore !== bestRank.updatedScore) {
            if (current.updatedScore > bestRank.updatedScore)
                best = row;
            continue;
        }
        if (current.diff !== bestRank.diff) {
            if (current.diff < bestRank.diff)
                best = row;
            continue;
        }
        if (current.payoutValue !== bestRank.payoutValue) {
            if (current.payoutValue > bestRank.payoutValue)
                best = row;
            continue;
        }
        if (current.suffixBonus !== bestRank.suffixBonus) {
            if (current.suffixBonus > bestRank.suffixBonus)
                best = row;
            continue;
        }
        if (current.autoPenalty !== bestRank.autoPenalty) {
            if (current.autoPenalty < bestRank.autoPenalty)
                best = row;
            continue;
        }
    }
    if (!best)
        return null;
    const payoutSum = pool.reduce((sum, row) => sum + payoutFieldValue(row), 0);
    const grossSum = pool.reduce((sum, row) => sum + grossFieldValue(row), 0);
    return {
        ...best,
        payoutAmount: payoutSum,
        grossSales: grossSum,
        amount: payoutSum,
    };
}
function ensureCanonicalWeekStart(date) {
    return (0, weekWindow_1.canonicalNairobiWeekStartUtc)(date);
}
