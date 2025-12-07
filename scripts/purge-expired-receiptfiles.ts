import { prisma } from '../src/lib/prisma';
import { deleteS3Object } from '../src/lib/storage';

async function main() {
  console.log('Purging expired receipt files...');
  const now = new Date();
  const expired = await prisma.receiptFile.findMany({ where: { expiresAt: { lte: now } } });
  console.log(`Found ${expired.length} expired files`);
  let deleted = 0;
  for (const f of expired) {
    try {
      if (f.key && process.env.S3_BUCKET) {
        await deleteS3Object(process.env.S3_BUCKET, f.key);
      }
      await prisma.receiptFile.delete({ where: { id: f.id } });
      deleted++;
    } catch (e) {
      console.error('Failed to purge file', f.id, e);
    }
  }
  console.log(`Purged ${deleted} files`);
}

main().catch((err) => { console.error(err); process.exit(1); });
