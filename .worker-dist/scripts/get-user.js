"use strict";
/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const email = process.argv[2] || 'kiokojackson81@gmail.com';
    const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    console.log(JSON.stringify(u, null, 2));
}
main().finally(() => process.exit(0));
