const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async ()=>{
  try{
    const clientId = 'e20e8623-e422-4566-a08a-37751f4bc759';
    const newToken = 'rRJeNyEqFDocQrhTS6l6G1Tv1dTjq-w5WPrkyb5k3PE';
    const cred = await prisma.apiCredential.findFirst({ where: { clientId } });
    if(!cred) throw new Error('No ApiCredential found for clientId ' + clientId);
    await prisma.apiCredential.update({ where: { id: cred.id }, data: { refreshToken: newToken } });
    console.log('Updated refreshToken for credential', cred.id);
  }catch(e){ console.error('ERROR', e); process.exitCode=2; }
  finally{ await prisma.$disconnect(); }
})();
