const { PrismaClient } = require('@prisma/client');
(async function(){
  const prisma = new PrismaClient();
  const email = process.argv[2] || 'jeniffer@betech.co.ke';
  try{
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, attendantCategory: true, role: true } });
    console.log(JSON.stringify(u, null, 2));
  }catch(e){
    console.error('ERR', e);
    process.exitCode = 1;
  }finally{
    await prisma.$disconnect();
  }
})();
