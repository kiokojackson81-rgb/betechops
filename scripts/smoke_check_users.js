#!/usr/bin/env node
/*
 Smoke test for given attendant accounts.
 For each user, the script fetches the DB row and checks:
  - existence
  - isActive
  - attendantCategory
  - whether a password hash exists and matches the provided plaintext

 Usage (PowerShell):
 $env:DATABASE_URL = "postgresql://..."
 node scripts/smoke_check_users.js

 NOTE: This script reads password hashes from the DB to run bcrypt.compare
 against the supplied plaintexts passed below. Do not expose results publicly.
*/
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const usersToCheck = [
  { email: 'jeniffer@betech.co.ke', plain: 'Jeniffer@#2020' },
  { email: 'brendah@betech.co.ke', plain: 'brendah@#2020' },
  { email: 'stephen@betech.co.ke', plain: 'stephen@#2020' },
  { email: 'justus@betech.co.ke', plain: 'justus@#2020' },
  { email: 'benjamin@betech.co.ke', plain: 'benjamin@#2020' },
];

async function main() {
  const results = [];
  for (const u of usersToCheck) {
    try {
      const row = await prisma.user.findUnique({
        where: { email: u.email },
        select: { id: true, email: true, role: true, isActive: true, attendantCategory: true, password: true }
      });
      if (!row) {
        results.push({ email: u.email, found: false });
        continue;
      }
      const hasPassword = Boolean(row.password);
      let passwordMatches = null;
      if (hasPassword) {
        try {
          passwordMatches = await bcrypt.compare(u.plain, row.password);
        } catch (e) {
          passwordMatches = 'compare-error';
        }
      }
      results.push({
        email: row.email,
        id: row.id,
        role: row.role,
        isActive: row.isActive,
        attendantCategory: row.attendantCategory,
        hasPassword,
        passwordMatches,
      });
    } catch (err) {
      results.push({ email: u.email, error: String(err) });
    }
  }

  console.log('Smoke check results:');
  console.table(results.map(r => ({
    email: r.email,
    id: r.id || null,
    found: typeof r.found === 'boolean' ? r.found : true,
    isActive: r.isActive ?? null,
    role: r.role ?? null,
    attendantCategory: r.attendantCategory ?? null,
    hasPassword: r.hasPassword ?? false,
    passwordMatches: r.passwordMatches,
    error: r.error ?? null,
  })));
}

main()
  .catch(err => {
    console.error('Error running smoke check:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
