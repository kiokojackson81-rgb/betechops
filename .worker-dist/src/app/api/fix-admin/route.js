"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
async function GET() {
    const email = "kiokojackson81@gmail.com";
    await prisma_1.prisma.user.updateMany({
        where: { email },
        data: { role: "ADMIN" },
    });
    return server_1.NextResponse.json({ fixed: true, email, role: "ADMIN" });
}
