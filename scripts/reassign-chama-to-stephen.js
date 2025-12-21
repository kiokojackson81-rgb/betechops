const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const id = 'cmipv85g20001js04pepbcjdk';
    console.log('Fetching adjustment before update...');
    const before = await prisma.attendantPayrollAdjustment.findUnique({ where: { id } });
    console.log('before:', before);

    console.log('Updating attendantId to Stephen (cmimxqfgo0004v5mc5pn1r486)');
    const updated = await prisma.attendantPayrollAdjustment.update({ where: { id }, data: { attendantId: 'cmimxqfgo0004v5mc5pn1r486' } });
    console.log('updated:', updated);
  } catch (e) {
    console.error('Failed:', e);
    process.exitCode = 1;
  } finally {
    try { await new PrismaClient().$disconnect(); } catch (_) {}
  }
}

main();
