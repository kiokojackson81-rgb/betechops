const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const receiptId = 'cmjqw74yf0001v5500m8tu3xj';
  const dailyEntryId = 'cmjqw74ye0000v550ok7gekus';
  try {
    console.log('Deleting receipt', receiptId);
    await prisma.supportReceipt.delete({ where: { id: receiptId } });
    console.log('Deleted receipt', receiptId);
  } catch (e) {
    console.error('Failed deleting receipt (may not exist):', e.message || e);
  }
  try {
    console.log('Deleting supportDailyEntry', dailyEntryId);
    await prisma.supportDailyEntry.delete({ where: { id: dailyEntryId } });
    console.log('Deleted supportDailyEntry', dailyEntryId);
  } catch (e) {
    console.error('Failed deleting supportDailyEntry (may not exist):', e.message || e);
  } finally {
    await prisma.$disconnect();
  }
})();
