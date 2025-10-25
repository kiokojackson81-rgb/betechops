import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create Shop (find or create)
  let shop = await prisma.shop.findFirst({ where: { name: "Main Shop", location: "Nairobi CBD" } });
  if (!shop) {
    shop = await prisma.shop.create({ data: { name: "Main Shop", location: "Nairobi CBD", phone: "+254722151083", email: "shop@betech.co.ke" } });
  }

  // Create User as an attendant
  const attendant = await prisma.user.upsert({
    where: { email: "attendant@betech.co.ke" },
    update: {},
    create: {
      email: "attendant@betech.co.ke",
      name: "Default Attendant",
      role: "ATTENDANT",
      isActive: true,
    },
  });

  // Create Product
  const product = await prisma.product.upsert({
    where: { sku: "BAT-100AH" },
    update: {},
    create: {
      sku: "BAT-100AH",
      name: "100Ah Solar Battery",
      category: "Battery",
      sellingPrice: 12000,
      lastBuyingPrice: 10000,
      stockQuantity: 10,
    },
  });

  console.log({ shop, attendant, product });

  // Ensure JM (Jumia) shop exists and create per-shop ApiCredential linking to env values
  try {
    let jmShop = await prisma.shop.findFirst({ where: { name: "Jumia Shop" } });
    if (!jmShop) {
      jmShop = await prisma.shop.create({ data: { name: "Jumia Shop" } });
    }

    const existingCred = await prisma.apiCredential.findFirst({ where: { shopId: jmShop.id } });
    if (existingCred) {
      await prisma.apiCredential.update({
        where: { id: existingCred.id },
        data: {
          // Prefer canonical base_url, fall back to legacy JUMIA_API_BASE
          apiBase: process.env.base_url || process.env.JUMIA_API_BASE || existingCred.apiBase,
          // OIDC env names preferred
          issuer: process.env.OIDC_ISSUER || process.env.JUMIA_OIDC_ISSUER || existingCred.issuer,
          clientId: process.env.OIDC_CLIENT_ID || process.env.JUMIA_CLIENT_ID || existingCred.clientId,
          refreshToken: process.env.OIDC_REFRESH_TOKEN || process.env.JUMIA_REFRESH_TOKEN || existingCred.refreshToken,
          apiSecret: process.env.OIDC_CLIENT_SECRET || process.env.JUMIA_CLIENT_SECRET || existingCred.apiSecret,
        },
      });
      console.log('Updated existing Jumia ApiCredential');
    } else {
      await prisma.apiCredential.create({
        data: {
          scope: `SHOP:${jmShop.id}`,
          apiBase: process.env.base_url || process.env.JUMIA_API_BASE || '',
          issuer: process.env.OIDC_ISSUER || process.env.JUMIA_OIDC_ISSUER || '',
          clientId: process.env.OIDC_CLIENT_ID || process.env.JUMIA_CLIENT_ID || '',
          refreshToken: process.env.OIDC_REFRESH_TOKEN || process.env.JUMIA_REFRESH_TOKEN || '',
          apiSecret: process.env.OIDC_CLIENT_SECRET || process.env.JUMIA_CLIENT_SECRET || '',
          shopId: jmShop.id,
        },
      });
      console.log('Created Jumia ApiCredential for JM shop');
    }
  } catch (e) {
    console.warn('JM shop credential upsert skipped or failed:', e instanceof Error ? e.message : String(e));
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect();
  });