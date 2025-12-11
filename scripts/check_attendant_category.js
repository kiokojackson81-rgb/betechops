#!/usr/bin/env node
/*
 Simple script to list users whose `attendantCategory` is NULL.
 Usage:
   Set `DATABASE_URL` in your environment, then run:
     node scripts/check_attendant_category.js

 Example (PowerShell):
   $env:DATABASE_URL = "postgresql://...";
   node scripts/check_attendant_category.js
*/
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking for users with null attendantCategory...');
  const rows = await prisma.user.findMany({
    where: { attendantCategory: null },
    select: { id: true, email: true, role: true, isActive: true },
    take: 500,
  });
  console.log(`Found ${rows.length} users with null attendantCategory`);
  if (rows.length > 0) {
    console.table(rows.map(r => ({ id: r.id, email: r.email, role: r.role, isActive: r.isActive })));
  }
}

main()
  .catch((err) => {
    console.error('Error checking attendant categories:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
