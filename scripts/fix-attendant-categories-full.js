#!/usr/bin/env node
// scripts/fix-attendant-categories-full.js
// Interactive utility to inspect and fix invalid values in User.attendantCategory
// Usage: node scripts/fix-attendant-categories-full.js
// Requires: DATABASE_URL environment variable and access to the DB

const { PrismaClient } = require('@prisma/client');
const prompt = require('prompt-sync')({ sigint: true });

const p = new PrismaClient();

const VALID = [
  'DIRECT_SALES_OPS',
  'MARKETING_OPS',
  'JUMIA_KILIMALL_OPS',
  'SUPPORT_OPS',
  'BETECH_OPS',
];

async function distinctCategories() {
  // Cast enum to text to avoid Prisma enum parsing errors
  return await p.$queryRaw`SELECT DISTINCT "attendantCategory"::text AS val FROM "User"`;
}

async function offendingRows() {
  return await p.$queryRaw`
    SELECT id, email, "attendantCategory"::text AS attendantCategory
    FROM "User"
    WHERE "attendantCategory" IS NOT NULL
      AND "attendantCategory" NOT IN (${PrismaArray(VALID)})
    ORDER BY email
  `;
}

// Helper to pass JS array into $queryRaw IN clause safely
function PrismaArray(arr) {
  // $queryRaw tagged template handles interpolation; this helper is for readability
  return arr;
}

async function addEnumValueIfMissing(value) {
  const label = String(value);
  // Check if enum label exists
  const found = await p.$queryRaw`
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'attendantcategory' AND e.enumlabel = ${label}
  `;
  if (found && found.length > 0) {
    console.log(`Enum label '${label}' already exists.`);
    return;
  }

  console.log(`Adding enum label '${label}' to type AttendantCategory`);
  try {
    // ALTER TYPE cannot run inside a transaction in older PG; ensure single statement
    await p.$executeRawUnsafe(`ALTER TYPE "AttendantCategory" ADD VALUE '${label.replace("'","''" )}'`);
    console.log('Enum label added.');
  } catch (err) {
    console.error('Failed to add enum value:', err.message || err);
    throw err;
  }
}

async function updateRowsSetNull(badValue) {
  const res = await p.$executeRawUnsafe(
    `UPDATE "User" SET "attendantCategory" = NULL WHERE lower("attendantCategory") = ${escapeLiteral(badValue.toLowerCase())}`
  );
  return res;
}

async function updateRowsMapTo(badValue, toValue) {
  const res = await p.$executeRaw`
    UPDATE "User"
    SET "attendantCategory" = ${toValue}
    WHERE lower("attendantCategory") = ${String(badValue).toLowerCase()}
  `;
  return res;
}

function escapeLiteral(s) {
  // naive escape for single quotes
  return `${s.replace(/'/g, "''")}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL env var. Set it before running.');
    process.exit(2);
  }

  console.log('Connecting to database...');
  try {
    const distinct = await distinctCategories();
    console.log('\nDistinct attendantCategory values (raw):');
    distinct.forEach((r) => console.log('  ', r.val));

    const offending = await offendingRows();
    if (!offending || offending.length === 0) {
      console.log('\nNo offending values found. Nothing to do.');
      return;
    }

    console.log(`\nFound ${offending.length} rows with invalid attendantCategory:`);
    offending.forEach((r, i) => console.log(`  ${i + 1}. id=${r.id} email=${r.email} attendantCategory=${r.attendantCategory}`));

    console.log('\nOptions:');
    console.log('  1) Set offending values to NULL (safe, quick)');
    console.log('  2) Map a specific offending value to an existing valid enum value');
    console.log('  3) Add a new enum label to the DB and then map offending values to it');
    console.log('  4) Exit');

    const choice = prompt('Choose an option (1/2/3/4): ');
    if (choice === '1') {
      const confirm = prompt("This will set all offending attendantCategory values to NULL. Type YES to continue: ");
      if (confirm !== 'YES') {
        console.log('Aborted. No changes made.');
        return;
      }
      // perform update per distinct offending value
      const badVals = Array.from(new Set(offending.map((r) => r.attendantCategory)));
      for (const v of badVals) {
        console.log(`Setting '${v}' -> NULL`);
        const res = await p.$executeRaw`
          UPDATE "User" SET "attendantCategory" = NULL WHERE lower("attendantCategory") = ${String(v).toLowerCase()}
        `;
        console.log('Result:', res);
      }
      console.log('Done.');
    } else if (choice === '2') {
      const badVal = prompt('Enter the offending value to map (exact as shown): ');
      if (!badVal) { console.log('No value entered. Exiting.'); return; }
      console.log('Valid target enum values:', VALID.join(', '));
      const toVal = prompt('Enter the target existing enum value (case-sensitive): ');
      if (!toVal || !VALID.includes(toVal)) { console.log('Invalid target. Exiting.'); return; }
      const confirm = prompt(`Map '${badVal}' -> '${toVal}' ? Type YES to continue: `);
      if (confirm !== 'YES') { console.log('Aborted.'); return; }
      const res = await p.$executeRaw`
        UPDATE "User" SET "attendantCategory" = ${toVal} WHERE lower("attendantCategory") = ${String(badVal).toLowerCase()}
      `;
      console.log('Result:', res);
      console.log('Done.');
    } else if (choice === '3') {
      const badVal = prompt('Enter the offending value to map (exact as shown): ');
      if (!badVal) { console.log('No value entered. Exiting.'); return; }
      const newLabel = prompt('Enter the new enum label to add (case-sensitive): ');
      if (!newLabel) { console.log('No new label entered. Exiting.'); return; }
      console.log(`The script will try to add enum label '${newLabel}' to type AttendantCategory and then map '${badVal}' to it.`);
      const confirm = prompt(`Proceed? Type YES to continue: `);
      if (confirm !== 'YES') { console.log('Aborted.'); return; }
      await addEnumValueIfMissing(newLabel);
      // map
      const res = await p.$executeRaw`
        UPDATE "User" SET "attendantCategory" = ${newLabel} WHERE lower("attendantCategory") = ${String(badVal).toLowerCase()}
      `;
      console.log('Result:', res);
      console.log('Done.');
    } else {
      console.log('Exit. No changes made.');
    }
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 2;
  } finally {
    await p.$disconnect();
  }
}

main();
