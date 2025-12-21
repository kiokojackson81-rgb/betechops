const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const configs = await prisma.config.findMany({ where: { key: { contains: 'jumia' } }, orderBy: { key: 'asc' } });
  if (!configs || configs.length === 0) {
    console.log('No configs with key containing "jumia" found.');
    return;
  }
  console.log('Found configs:');
  configs.forEach(c => {
    console.log('- key=', c.key, 'value=', c.value ? c.value.slice(0, 200) : '(empty/undefined)', 'updatedAt=', c.updatedAt);
  });
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
