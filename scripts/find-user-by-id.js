const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  try {
    const u = await p.user.findUnique({ where: { id: 'cmimxqfgo0004v5mc5pn1r486' } });
    console.log(JSON.stringify(u));
  } catch (e) { console.error(e); process.exitCode = 1; } finally { try { await p.$disconnect(); } catch(_){} }
})();
