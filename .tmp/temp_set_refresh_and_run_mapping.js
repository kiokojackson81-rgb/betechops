const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const prisma = new PrismaClient();

(async ()=>{
  try{
    const clientId = 'e20e8623-e422-4566-a08a-37751f4bc759';
    const newToken = 'rRJeNyEqFDocQrhTS6l6G1Tv1dTjq-w5WPrkyb5k3PE';
    const cred = await prisma.apiCredential.findFirst({ where: { clientId } });
    if(!cred) throw new Error('No ApiCredential found for clientId ' + clientId);
    const old = cred.refreshToken;
    console.log('Setting temporary refreshToken on credential', cred.id);
    await prisma.apiCredential.update({ where: { id: cred.id }, data: { refreshToken: newToken } });

    try{
      console.log('Running jumia_build_shop_mapping.js');
      const out = execSync('node .tmp/jumia_build_shop_mapping.js', { stdio: 'inherit' });
    }catch(e){ console.error('mapping run failed', e); }

    console.log('Restoring old refreshToken (clearing)');
    await prisma.apiCredential.update({ where: { id: cred.id }, data: { refreshToken: old || null } });
    console.log('Done');
  }catch(e){ console.error('ERROR', e); process.exitCode=2; }
  finally{ await prisma.$disconnect(); }
})();
