import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create Shop (find or create)
  let shop = await prisma.shop.findFirst({ where: { name: "Main Shop", location: "Nairobi CBD" } });
  if (!shop) {
    shop = await prisma.shop.create({ data: { name: "Main Shop", location: "Nairobi CBD", phone: "+254722151083", email: "shop@betech.co.ke" } });
  }

  // Create baseline attendants with categories to showcase dashboards
  const attendants = [
    {
      email: "attendant@betech.co.ke",
      name: "Default Attendant",
      category: "GENERAL",
    },
    {
      email: "sales@betech.co.ke",
      name: "Direct Sales Lead",
      category: "DIRECT_SALES",
    },
    {
      email: "jumia.ops@betech.co.ke",
      name: "Jumia Ops Specialist",
      category: "JUMIA_OPERATIONS",
    },
    {
      email: "catalog@betech.co.ke",
      name: "Catalog Uploader",
      category: "PRODUCT_UPLOAD",
    },
  ] as const;

  const attendantRecords = await Promise.all(
    attendants.map((att) =>
      prisma.user.upsert({
        where: { email: att.email },
        update: { attendantCategory: att.category, isActive: true },
        create: {
          email: att.email,
          name: att.name,
          role: "ATTENDANT",
          attendantCategory: att.category,
          isActive: true,
        },
      })
    )
  );

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

  console.log({ shop, attendants: attendantRecords.map((a) => ({ email: a.email, category: a.attendantCategory })), product });

  // Seed sample activity logs so dashboards are populated
  try {
    const [directSales, jumiaOps, catalog] = [
      attendantRecords.find((a) => a.email === "sales@betech.co.ke"),
      attendantRecords.find((a) => a.email === "jumia.ops@betech.co.ke"),
      attendantRecords.find((a) => a.email === "catalog@betech.co.ke"),
    ];

    if (directSales) {
      await prisma.attendantActivity.create({
        data: {
          userId: directSales.id,
          category: "DIRECT_SALES",
          metric: "DAILY_SALES",
          numericValue: 18500,
          notes: "Walk-ins and MPESA collections",
        },
      });
    }

    if (jumiaOps) {
      await prisma.attendantActivity.create({
        data: {
          userId: jumiaOps.id,
          category: "JUMIA_OPERATIONS",
          metric: "ORDER_PROCESSING",
          intValue: 24,
          notes: "Orders confirmed and packed today",
        },
      });
    }

    if (catalog) {
      await prisma.attendantActivity.create({
        data: {
          userId: catalog.id,
          category: "PRODUCT_UPLOAD",
          metric: "PRODUCT_UPLOADS",
          intValue: 18,
          notes: "Inverters & batteries batch upload",
        },
      });
    }
  } catch (activityError) {
    console.warn("activity seeding skipped:", activityError instanceof Error ? activityError.message : activityError);
  }

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
