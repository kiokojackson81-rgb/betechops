require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function ensureEnum(name, values) {
  const exists = await prisma.$queryRaw`
    SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = ${name}) AS present
  `;
  if (exists[0] && exists[0].present) {
    console.log('Enum', name, 'already exists');
    return;
  }
  const vals = values.map(v => `'${v}'`).join(',');
  console.log('Creating enum', name, 'with values', values.join(','));
  await prisma.$executeRawUnsafe(`CREATE TYPE "${name}" AS ENUM (${vals})`);
}

async function main(){
  try {
    await ensureEnum('WeeklySaleSource', ['AUTOMATIC','MANUAL']);
    await ensureEnum('WeeklySaleStatus', ['PENDING','APPROVED','REJECTED']);
    console.log('Enums ensured');
  } catch (e) {
    console.error('Failed to ensure enums', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
