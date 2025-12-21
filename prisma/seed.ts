import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

async function main() {
  const prisma = new PrismaClient();
  // Use raw SQL to seed Branding to avoid Prisma client mapping issues during reconciliation.
  const letterhead = process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL || '/letterhead.jpg';
  const logo = process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL || '/logo.png';
  const color = '#7A2020';
  const id = `seed-${randomUUID()}`;

  await prisma.$executeRaw`
    INSERT INTO "public"."Branding" (id, name, "letterheadUrl", "logoUrl", "brandColor", "updatedAt")
    VALUES (${id}, 'default', ${letterhead}, ${logo}, ${color}, now())
    ON CONFLICT (name) DO UPDATE
    SET "letterheadUrl" = EXCLUDED."letterheadUrl",
        "logoUrl" = EXCLUDED."logoUrl",
        "brandColor" = EXCLUDED."brandColor",
        "updatedAt" = now();
  `;
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
