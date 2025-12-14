#!/usr/bin/env node
// scripts/list-fix-attendant-categories.js
// Usage:
//   node scripts/list-fix-attendant-categories.js           # list distinct values + offending rows
//   node scripts/list-fix-attendant-categories.js --fix --from=junior --to=MARKETING_OPS
//   node scripts/list-fix-attendant-categories.js --fix --from=junior --null

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const VALID = [
  'DIRECT_SALES_OPS',
  'MARKETING_OPS',
  'JUMIA_KILIMALL_OPS',
  'SUPPORT_OPS',
  'BETECH_OPS',
];

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg === '--fix') args.fix = true;
    if (arg.startsWith('--from=')) args.from = arg.split('=')[1];
    if (arg.startsWith('--to=')) args.to = arg.split('=')[1];
    if (arg === '--null') args.toNull = true;
  });
  return args;
}

async function main() {
  const args = parseArgs();

  console.log('Connecting to DB...');
  try {
    // get distinct values via raw SQL casting enum to text to avoid Prisma enum parsing errors
    const distinct = await p.$queryRaw`SELECT DISTINCT "attendantCategory"::text AS val FROM "User"`;
    console.log('\nDistinct attendantCategory values (raw):');
    distinct.forEach((r) => console.log('  ', r.val));

    // fetch rows with non-null categories
    const rows = await p.$queryRaw`SELECT id, email, "attendantCategory"::text AS attendantCategory FROM "User" WHERE "attendantCategory" IS NOT NULL`;

    const offending = rows.filter((r) => !VALID.includes(r.attendantCategory));

    if (offending.length === 0) {
      console.log('\nNo offending attendantCategory values found.');
    } else {
      console.log(`\nFound ${offending.length} rows with invalid attendantCategory:`);
      offending.slice(0, 200).forEach((r) => console.log(`  id=${r.id} email=${r.email} attendantCategory=${r.attendantCategory}`));
      if (offending.length > 200) console.log('  ... (truncated)');
    }

    if (args.fix) {
      if (!args.from) {
        console.error('\n--fix requires --from=<value> to indicate which DB value to replace');
        process.exit(1);
      }
      if (!args.to && !args.toNull) {
        console.error('\n--fix requires either --to=<VALID_ENUM> or --null to set to NULL');
        process.exit(1);
      }

      if (args.to && !VALID.includes(args.to)) {
        console.error(`\nTarget value '${args.to}' is not one of the valid enum labels: ${VALID.join(', ')}`);
        process.exit(1);
      }

      console.log(`\nAbout to update rows where attendantCategory='${args.from}'`);
      if (args.toNull) console.log('  -> setting to NULL');
      else console.log(`  -> setting to '${args.to}'`);

      // Confirm prompt (simple)
      const prompt = require('prompt-sync')({ sigint: true });
      const answer = prompt('Proceed with update? type YES to continue: ');
      if (answer !== 'YES') {
        console.log('Aborted by user. No changes made.');
        process.exit(0);
      }

      let res;
      if (args.toNull) {
        res = await p.$executeRaw`UPDATE "User" SET "attendantCategory" = NULL WHERE "attendantCategory" = ${args.from}`;
      } else {
        res = await p.$executeRaw`UPDATE "User" SET "attendantCategory" = ${args.to} WHERE "attendantCategory" = ${args.from}`;
      }
      console.log('Update executed. Result:', res);
    }
  } catch (err) {
    console.error('Error while inspecting/fixing attendantCategory:', err);
    process.exitCode = 2;
  } finally {
    await p.$disconnect();
  }
}

main();
