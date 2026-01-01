(async ()=>{
  // This script expects to be run with ts-node and tsconfig-paths, e.g.:
  // node -r ts-node/register -r tsconfig-paths/register scripts/fetch-earnings-summary-jeniffer.js
  try {
    require('ts-node/register');
    require('tsconfig-paths/register');
  } catch (e) {
    // if already provided via -r flags, it's fine
  }

  const { prisma } = await import('../src/lib/prisma.ts');
  const { getEarningsSummaryForUser } = await import('../src/lib/earningsSummary.ts');

  try {
    const user = await prisma.user.findUnique({ where: { email: 'jeniffer@betech.co.ke' }, select: { id: true, email: true } });
    if (!user) return console.error('User not found: jeniffer@betech.co.ke');
    const summary = await getEarningsSummaryForUser({ userId: user.id });
    console.log(JSON.stringify(summary, null, 2));
  } catch (e) {
    console.error('Error fetching summary:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
