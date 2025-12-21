const { PrismaClient } = require('@prisma/client');
async function main(){
  const prisma = new PrismaClient();
  try {
    const branding = await prisma.branding.findUnique({ where: { name: 'default' } });
    console.log(branding ? JSON.stringify(branding, null, 2) : 'missing');
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(console.error);
