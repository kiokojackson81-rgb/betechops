import { PrismaClient, Platform, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Default payload from the user's provided JSON
const defaultCreds = {
  platform: 'JUMIA',
  apiBase: 'https://vendor-api.jumia.com',
  base_url: 'https://vendor-api.jumia.com',
  tokenUrl: 'https://vendor-api.jumia.com/token',
  clientId: 'd3f5a649-bbcb-4b11-948d-64b1bb036020',
  refreshToken: '5JKyMUN0hImO8KP70qTCXRp_xmBWekJussuyK7w2T5I',
  authType: 'SELF_AUTHORIZATION',
  shopLabel: 'JM Collection',
};

async function main() {
  const name = process.env.SHOP_NAME || defaultCreds.shopLabel || 'JM Collection';
  const platformEnv = (process.env.SHOP_PLATFORM as keyof typeof Platform) || 'JUMIA';

  // Allow overriding credentials via env var SHOP_JSON (stringified JSON)
  let creds: any = defaultCreds;
  if (process.env.SHOP_JSON) {
    try { creds = JSON.parse(process.env.SHOP_JSON); } catch (e) { console.warn('Invalid SHOP_JSON; falling back to defaults'); }
  }

  // Ensure required fields
  if (!creds.tokenUrl || !creds.clientId || !creds.refreshToken) {
    throw new Error('Missing required credential fields: tokenUrl, clientId, refreshToken');
  }

  // Find existing shop by name
  const existing = await prisma.shop.findFirst({ where: { name } });

  const data: Prisma.ShopCreateInput = {
    name,
    platform: Platform[platformEnv] ?? Platform.JUMIA,
    isActive: true,
    // Store credentials in plaintext JSON (code will use directly or decrypt if encrypted). 
    // If you prefer encryption, replace this with your encryptJsonForStorage helper.
    credentialsEncrypted: creds as unknown as Prisma.InputJsonValue,
  };

  if (existing) {
    await prisma.shop.update({ where: { id: existing.id }, data });
    console.log(`Updated shop '${name}' (${existing.id})`);
  } else {
    const created = await prisma.shop.create({ data });
    console.log(`Created shop '${name}' (${created.id})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)); });
