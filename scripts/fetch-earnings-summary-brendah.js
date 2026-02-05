(async ()=>{
  // Run with: node -r ts-node/register -r tsconfig-paths/register scripts/fetch-earnings-summary-brendah.js
  try { require('ts-node/register'); require('tsconfig-paths/register'); } catch(e){}

  const { prisma } = await import('../src/lib/prisma.ts');
  const { getEarningsSummaryForUser } = await import('../src/lib/earningsSummary.ts');

  try {
    const user = await prisma.user.findUnique({ where: { email: 'brendah@betech.co.ke' }, select: { id: true, email: true } });
    if (!user) return console.error('User not found: brendah@betech.co.ke');
    const summary = await getEarningsSummaryForUser({ userId: user.id });
    console.log(JSON.stringify(summary, null, 2));
  } catch (e) {
    console.error('Error fetching summary:', e && e.message ? e.message : e);
  } finally {
    try{ await prisma.$disconnect(); } catch(_){}
  }
})();
