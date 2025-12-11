const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const id = 'cmj035t27000eic045hpju8q5';
    const r = await p.supportReceipt.findUnique({ where: { id }, include: { items: true, dailyEntry: { include: { submittedBy: true } } } });
    console.log('supportReceipt full:');
    console.dir(r, { depth: null });
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    try { await p.$disconnect(); } catch (_) {}
  }
})();
