const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const rows = await prisma.$queryRaw`SELECT id, scope, "clientId", "apiBase", "issuer", "refreshToken", "createdAt", "updatedAt" FROM "ApiCredential" WHERE scope IN ('JUMIA_VENDOR', 'GLOBAL') OR lower("apiBase") LIKE '%jumia%' ORDER BY "updatedAt" DESC`;
    console.log('api_credentials:');
    console.table(rows);
  } catch (err) {
    console.error('Query failed', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
