"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEvidencePolicy = getEvidencePolicy;
const prisma_1 = require("@/lib/prisma");
const DEFAULT_POLICY = {
    electronics: { photo: 2, signature: 1 },
};
async function getEvidencePolicy() {
    try {
        const row = await prisma_1.prisma.config.findUnique({ where: { key: "returns_evidence_policy" } });
        if (row === null || row === void 0 ? void 0 : row.json)
            return row.json;
    }
    catch (_a) {
        // ignore
    }
    return DEFAULT_POLICY;
}
