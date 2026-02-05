import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const JUDE_SHOP_SID = '5497640c-3f51-4777-82fa-fc1c92dc588b';
const JUDE_DISPLAY = 'Jude Collection';
const BENJ_EMAIL = 'benjamin@betech.co.ke';

async function main() {
  const report: any = { createdAt: new Date().toISOString(), actions: [] };

  // Find Benjamin user id
  const userRow: any = await prisma.$queryRawUnsafe(`SELECT id FROM "User" WHERE lower(email) = '${BENJ_EMAIL.toLowerCase()}' LIMIT 1`);
  const benId = userRow?.[0]?.id;
  if (!benId) {
    console.error('Benjamin user not found:', BENJ_EMAIL);
    process.exit(1);
  }
  report.benjaminId = benId;

  // Ensure Jude Collection MarketplaceAccount exists (create or update)
  let acct = (await prisma.$queryRawUnsafe(`SELECT id, "jumiaShopSid", "isActive" FROM "MarketplaceAccount" WHERE "jumiaShopSid" = '${JUDE_SHOP_SID}' LIMIT 1`)) as any;
  if (!acct || acct.length === 0) {
    const created = await prisma.marketplaceAccount.create({
      data: {
        displayName: JUDE_DISPLAY,
        platform: 'JUMIA',
        countryCode: 'KE',
        currency: 'KES',
        jumiaShopSid: JUDE_SHOP_SID,
        isActive: true,
      },
    });
    report.actions.push({ action: 'create_account', accountId: created.id });
    acct = [{ id: created.id, jumiaShopSid: JUDE_SHOP_SID, isActive: true }];
  }
  const accountId = acct[0].id;

  // Ensure active flag true
  await prisma.$executeRawUnsafe(`UPDATE "MarketplaceAccount" SET "isActive" = true, "updatedAt" = now() WHERE id = '${accountId}'`);
  report.actions.push({ action: 'ensure_active', accountId });

  // Ensure Benjamin has SUPERVISOR assignment on this account
  const existingAssign: any = await prisma.$queryRawUnsafe(`SELECT id FROM "MarketplaceAccountAssignment" WHERE "accountId" = '${accountId}' AND "attendantId" = '${benId}' AND role::text = 'SUPERVISOR' AND ("endsAt" IS NULL OR "endsAt" > now()) LIMIT 1`);
  if (!existingAssign || existingAssign.length === 0) {
    await prisma.$executeRawUnsafe(`INSERT INTO "MarketplaceAccountAssignment" ("id","accountId","attendantId",role,"startsAt","createdAt","updatedAt") VALUES (gen_random_uuid(), '${accountId}', '${benId}', 'SUPERVISOR', now(), now(), now())`);
    report.actions.push({ action: 'assign_supervisor', accountId, attendantId: benId });
  } else {
    report.actions.push({ action: 'assignment_exists', accountId, attendantId: benId });
  }

  // Enable all KILIMALL accounts
  const enabled = await prisma.$executeRawUnsafe(`UPDATE "MarketplaceAccount" SET "isActive" = true, "updatedAt" = now() WHERE platform = 'KILIMALL' RETURNING id`);
  report.actions.push({ action: 'enable_kilimall', updated: Array.isArray(enabled) ? enabled.length : enabled });

  fs.writeFileSync('.tmp/assign_jude_and_enable_kilimall_report.json', JSON.stringify(report, null, 2));
  console.log('Done. Report written to .tmp/assign_jude_and_enable_kilimall_report.json');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script failed', err);
    process.exit(1);
  });
