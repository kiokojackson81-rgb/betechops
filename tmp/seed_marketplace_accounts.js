const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const accountDefs = [
  { name: 'Betech Store', platform: 'JUMIA', shopSid: 'e20e8623-e422-4566-a08a-37751f4bc759', assignee: 'benjamin@betech.co.ke', credential: { clientId: 'e20e8623-e422-4566-a08a-37751f4bc759', refreshToken: 'ZDtXhILVt4aaOaMzvimP-aPf24hVRqRIQHnBqKkusro' } },
  { name: 'Hitech Power', platform: 'JUMIA', shopSid: '8c0e5ed0-8eb7-49c6-982c-1acdfef94d37', assignee: 'benjamin@betech.co.ke', credential: { clientId: '8c0e5ed0-8eb7-49c6-982c-1acdfef94d37', refreshToken: 'c6cbZEvITNbzpDswbqL8ohHXiYiMHvijPOQ5NSiZVho' } },
  { name: 'Sky Store Ke', platform: 'JUMIA', shopSid: 'cd95a840-f194-4f49-88fd-848f2c59456f', assignee: 'benjamin@betech.co.ke', credential: { clientId: 'cd95a840-f194-4f49-88fd-848f2c59456f', refreshToken: 'g4tuabSji2kDNqhJw6ZB0FzIrNViXnjZMoDs8dmqCa8' } },
  { name: 'LabTech Kenya', platform: 'JUMIA', shopSid: '3579f345-a3ac-4e9d-b355-1990f0ad8a54', assignee: 'benjamin@betech.co.ke', credential: { clientId: '3579f345-a3ac-4e9d-b355-1990f0ad8a54', refreshToken: '2f6INQ7qtY-NfVt2u1loWQz4WpMElqY4KhdYqQaRc40' } },
  { name: 'JM Latest Collections', platform: 'JUMIA', shopSid: 'f7df0953-7c18-4191-b304-614f9f0987a4', assignee: 'stephen@betech.co.ke', credential: { clientId: 'f7df0953-7c18-4191-b304-614f9f0987a4', refreshToken: '6imHenWrlNgC31pA5n7LIVN_LCKRF2hlMGV90m_3GyI' } },
  { name: 'Betech Solar Solution', platform: 'JUMIA', shopSid: 'b2a290cc-74fd-4b9e-a598-ef42fc57f918', assignee: 'stephen@betech.co.ke', credential: { clientId: 'b2a290cc-74fd-4b9e-a598-ef42fc57f918', refreshToken: 'DaOJdJaGNK9Awt7w1UCh5hD69UCi6yE6iYI2QL6zVrs' } },
  { name: 'Maxton Enterprise', platform: 'JUMIA', shopSid: '61e52422-f98e-49da-87e2-f9c832bf1a04', assignee: 'stephen@betech.co.ke', credential: { clientId: '61e52422-f98e-49da-87e2-f9c832bf1a04', refreshToken: 'NcTY3YJlPdk3-4TROf5sfDOlo3yo234njGyfMQIUjmE' } },
  { name: 'Betech Kilimall', platform: 'KILIMALL', shopCode: 'BETECH_KILIMALL', assignee: 'stephen@betech.co.ke' },
  { name: 'Hitech Access', platform: 'KILIMALL', shopCode: 'HITECH_ACCESS', assignee: 'stephen@betech.co.ke' },
  { name: 'Betech Solar Kilimall', platform: 'KILIMALL', shopCode: 'BETECH_SOLAR_KILIMALL', assignee: 'stephen@betech.co.ke' },
  { name: 'JM Collection', platform: 'KILIMALL', shopCode: 'JM_COLLECTION', assignee: 'stephen@betech.co.ke' },
  { name: 'Hitech Power Kilimall', platform: 'KILIMALL', shopCode: 'HITECH_POWER_KILIMALL', assignee: 'stephen@betech.co.ke' },
];

async function upsertAccount(def) {
  const user = await prisma.user.findFirst({ where: { email: def.assignee } });
  if (!user) {
    throw new Error(`User not found for email ${def.assignee}`);
  }

  let account = await prisma.marketplaceAccount.findFirst({ where: { displayName: def.name } });
  if (!account) {
    account = await prisma.marketplaceAccount.create({
      data: {
        platform: def.platform,
        displayName: def.name,
        countryCode: 'KE',
        currency: 'KES',
        jumiaShopSid: def.platform === 'JUMIA' ? def.shopSid : null,
        kilimallShopCode: def.platform === 'KILIMALL' ? def.shopCode : null,
        isActive: true,
      },
    });
    console.log(`Created account ${def.name}`);
  } else {
    account = await prisma.marketplaceAccount.update({
      where: { id: account.id },
      data: {
        platform: def.platform,
        countryCode: 'KE',
        currency: 'KES',
        jumiaShopSid: def.platform === 'JUMIA' ? def.shopSid : account.jumiaShopSid,
        kilimallShopCode: def.platform === 'KILIMALL' ? def.shopCode : account.kilimallShopCode,
        isActive: true,
      },
    });
    console.log(`Updated account ${def.name}`);
  }

  const role = def.assignee === 'benjamin@betech.co.ke' ? 'SUPERVISOR' : 'JUMIA_KILIMALL_OPS';

  await prisma.marketplaceAccountAssignment.upsert({
    where: {
      accountId_attendantId_role: {
        accountId: account.id,
        attendantId: user.id,
        role,
      },
    },
    create: {
      accountId: account.id,
      attendantId: user.id,
      role,
    },
    update: {
      endsAt: null,
    },
  });

  if (def.credential) {
    await prisma.apiCredential.upsert({
      where: { scope: `MARKETPLACE_ACCOUNT:${account.id}` },
      create: {
        scope: `MARKETPLACE_ACCOUNT:${account.id}`,
        apiBase: 'https://vendor-api.jumia.com',
        clientId: def.credential.clientId,
        refreshToken: def.credential.refreshToken,
      },
      update: {
        clientId: def.credential.clientId,
        refreshToken: def.credential.refreshToken,
      },
    });
  }
}

async function run() {
  try {
    for (const def of accountDefs) {
      await upsertAccount(def);
    }
    console.log('Marketplace accounts seeding complete.');
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
