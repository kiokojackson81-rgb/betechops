"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PENDING_SNAPSHOT_KEY = void 0;
exports.writePendingSnapshot = writePendingSnapshot;
exports.readPendingSnapshot = readPendingSnapshot;
exports.isPendingSnapshotFresh = isPendingSnapshotFresh;
const prisma_1 = require("../prisma");
exports.PENDING_SNAPSHOT_KEY = "jumia:pending-live";
async function writePendingSnapshot(snapshot) {
    await prisma_1.prisma.config.upsert({
        where: { key: exports.PENDING_SNAPSHOT_KEY },
        update: { json: snapshot },
        create: { key: exports.PENDING_SNAPSHOT_KEY, json: snapshot },
    });
}
async function readPendingSnapshot() {
    try {
        const row = await prisma_1.prisma.config.findUnique({ where: { key: exports.PENDING_SNAPSHOT_KEY } });
        if (!row?.json)
            return null;
        const snapshot = row.json;
        if (typeof snapshot?.totalOrders !== "number")
            return null;
        return snapshot;
    }
    catch (error) {
        console.error("[jumia.pendingSnapshot] read failed", error);
        return null;
    }
}
function isPendingSnapshotFresh(snapshot, maxAgeMs) {
    const referenceIso = snapshot?.completedAt || snapshot?.startedAt;
    if (!referenceIso)
        return false;
    const referenceMs = Date.parse(referenceIso);
    if (!Number.isFinite(referenceMs))
        return false;
    return Date.now() - referenceMs <= maxAgeMs;
}
