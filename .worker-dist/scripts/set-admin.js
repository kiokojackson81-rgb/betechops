"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../src/lib/prisma");
async function main() {
    await prisma_1.prisma.user.upsert({
        where: { email: "kiokojackson81@gmail.com" },
        update: { role: "ADMIN" },
        create: { email: "kiokojackson81@gmail.com", role: "ADMIN", name: "Admin" },
    });
    console.log("Admin ensured.");
}
main().finally(() => process.exit(0));
