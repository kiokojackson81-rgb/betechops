import 'dotenv/config';
import { prisma } from '../src/lib/prisma.ts';

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: ts-node scripts/find-user-by-id.ts <USER_ID>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    console.log('NOT_FOUND');
  } else {
    console.log('FOUND', user.email);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
