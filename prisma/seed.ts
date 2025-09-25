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
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect();
  });