try{require('dotenv').config();}catch{}
(async ()=>{
  const prisma = require('../.worker-dist/src/lib/prisma').prisma;
  try{
    const j = await prisma.jumiaAccount.findMany();
    console.log('JumiaAccounts:', JSON.stringify(j, null, 2));
  }catch(e){console.error(e);process.exit(1);}finally{await prisma.$disconnect().catch(()=>{});} 
})();
