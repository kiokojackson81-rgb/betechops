"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chooseAuthoritativeCandidate = chooseAuthoritativeCandidate;
// Choose authoritative candidate per rules:
// - Prefer non-zero `amount` candidates
// - If multiple non-zero, pick earliest `createdAt`
// - If none non-zero, pick earliest `createdAt`
function chooseAuthoritativeCandidate(candidates) {
    if (!candidates || candidates.length === 0)
        throw new Error('no candidates');
    const nonZero = candidates.filter((c) => c.amount > 0);
    if (nonZero.length > 0) {
        nonZero.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return nonZero[0];
    }
    const copy = candidates.slice();
    copy.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return copy[0];
}
