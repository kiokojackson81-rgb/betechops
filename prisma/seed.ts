import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create Shop
  const shop = await prisma.shop.upsert({
    where: { name_location: { name: "Main Shop", location: "Nairobi CBD" } },
    update: {},
    create: {
      name: "Main Shop",
      location: "Nairobi CBD",
      phone: "+254722151083",
      email: "shop@betech.co.ke",
    },
  });

  // Create Attendant
  const attendant = await prisma.attendant.upsert({
    where: { email: "attendant@betech.co.ke" },
    update: {},
    create: {
      name: "Default Attendant",
      email: "attendant@betech.co.ke",
      phone: "+254700000000",
      shopId: shop.id,
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
      brand: "Starmax",
      actualPrice: 10000,
      sellingPrice: 12000,
      profitMargin: 2000,
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