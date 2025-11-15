"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasPublicPlatformEnum = hasPublicPlatformEnum;
// Returns true if public."Platform" enum type exists in the database
async function hasPublicPlatformEnum(prisma) {
    try {
        const rows = await prisma.$queryRaw `
      SELECT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'Platform'
      ) AS exists
    `;
        return Array.isArray(rows) && rows[0]?.exists === true;
    }
    catch {
        // If the metadata query itself fails, be conservative and report false
        return false;
    }
}
