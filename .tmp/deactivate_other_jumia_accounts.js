const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const confirmedShopSids = [
  '29e1f2ad-b898-4d11-b3df-ab3dda5755fc',
  '1951e826-57f2-4d6a-99ad-67b5139d8aca',
  '5497640c-3f51-4777-82fa-fc1c92dc588b',
  '45fd7334-a7db-4f49-ba60-347096fd818e',
  '07ee95b2-acb7-4436-b98f-d8ce30d0c518',
  'a4f06613-3271-4846-8b25-43b2bc093a80',
  'db15d4e6-19a0-4cc1-b8c9-0619c5388643',
  'c897dcd1-5a4d-4d68-80ff-e8fda74f79e4'
];

async function archiveAccount(id){
  try{
    await prisma.$executeRawUnsafe(`INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='${id}'`);
  }catch(e){ /* ignore */ }
}

(async ()=>{
  try{
    const others = await prisma.marketplaceAccount.findMany({ where: { platform: 'JUMIA', isActive: true } });
    for(const a of others){
      if(a.jumiaShopSid && confirmedShopSids.includes(a.jumiaShopSid)) continue; // keep confirmed
      // deactivate and archive
      await archiveAccount(a.id);
      await prisma.marketplaceAccount.update({ where: { id: a.id }, data: { isActive: false } });
      console.log('Deactivated JUMIA account', a.id, a.displayName, 'jumiaShopSid:', a.jumiaShopSid);
    }
    console.log('Deactivation pass complete');
  }catch(e){
    console.error('ERROR', e);
    process.exitCode = 2;
  }finally{
    await prisma.$disconnect();
  }
})();
