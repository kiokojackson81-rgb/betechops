"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const main = async () => {
    const shops = await prisma.shop.findMany({ select: { id: true, name: true, platform: true, isActive: true }, orderBy: { name: 'asc' } });
    console.log('Shops:');
    for (const s of shops) {
        console.log(`- [${s.platform}] ${s.name} (${s.id}) ${s.isActive ? '' : '(inactive)'}`);
    }
};
await main().finally(async () => { try {
    await prisma.$disconnect();
}
catch { } });
