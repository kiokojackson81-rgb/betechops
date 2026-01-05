const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const rows = await p.apiCredential.findMany({ orderBy: [{ updatedAt: 'desc' }], take: 100 });
    const out = rows.map(r => ({
      id: r.id,
      scope: r.scope,
      apiBase: r.apiBase,
      clientId: r.clientId ? (r.clientId.slice(0, 4) + '***') : null,
      issuer: r.issuer,
      shopId: r.shopId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
