#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mapping from human display name -> credentials provided
const mapping = [
  { name: 'Betech Solar Solution', clientId: 'b2a290cc-74fd-4b9e-a598-ef42fc57f918', refreshToken: 'Qn98F0sfQuL8ugv6Fi0VrWpzLIGUO6QRSYN_Cqt9c3g' },
  { name: 'Hitech Power', clientId: '8c0e5ed0-8eb7-49c6-982c-1acdfef94d37', refreshToken: 'VKMeMs2iR8xWCVqkxZR_Wi0YQbxseC-WP73JsiiIyiM' },
  { name: 'Jude', clientId: '70a7341a-1927-45a5-aec8-d0c5a4ac7b45', refreshToken: 'A9FDvmu0ayd6BdbMy1wwLWp-_KpymmTrIebzpNJc8hk' },
  { name: 'LabTech Kenya', clientId: '3579f345-a3ac-4e9d-b355-1990f0ad8a54', refreshToken: 'FgXLc5Ege8fo0GAt5b0FNIUN9gCdpsM9_38oAkow9cE' },
  { name: 'Maxton Enterprise', clientId: '61e52422-f98e-49da-87e2-f9c832bf1a04', refreshToken: 'jsOrwcztWPlwCTZhB1OvpcWz6Xrcuz1zP6vDl2yjoLE' },
  { name: 'Sky Store Ke', clientId: 'cd95a840-f194-4f49-88fd-848f2c59456f', refreshToken: 'YlhNxZy32ua32p00CQNnOHhlt38VuJfO2kiuPe4wxfg' },
  { name: 'JM Latest Collections', clientId: 'f7df0953-7c18-4191-b304-614f9f0987a4', refreshToken: 'h2Jm5XF6iwiE0Mo451SRfUv2FVuhChRhOy_I19NQoXg' },
  { name: 'Betech Store', clientId: 'e20e8623-e422-4566-a08a-37751f4bc759', refreshToken: 'rRJeNyEqFDocQrhTS6l6G1Tv1dTjq-w5WPrkyb5k3PE' },
];

(async ()=>{
  try{
    for (const m of mapping){
      console.log('---');
      console.log('Searching jumiaAccount by name fragment:', m.name);
      const acct = await prisma.jumiaAccount.findFirst({ where: { label: { contains: m.name, mode: 'insensitive' } } });
      if (!acct){
        console.log('No jumiaAccount found for', m.name, '— creating one');
        const created = await prisma.jumiaAccount.create({ data: { label: m.name, clientId: m.clientId, refreshToken: m.refreshToken } });
        console.log('Created jumiaAccount', created.id);
      } else {
        console.log('Found jumiaAccount', acct.id, 'label=', acct.label);
        await prisma.jumiaAccount.update({ where: { id: acct.id }, data: { clientId: m.clientId, refreshToken: m.refreshToken } });
        console.log('Updated jumiaAccount', acct.id);
      }
    }
    await prisma.$disconnect();
  }catch(e){ console.error('ERR', e); await prisma.$disconnect(); process.exit(1); }
})();
