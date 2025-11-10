import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const primaryName = "Betech Store"; // keep this casing
  const duplicateName = "Betech store"; // remove this one

  const primary = await prisma.shop.findFirst({ where: { name: primaryName } });
  const duplicate = await prisma.shop.findFirst({ where: { name: duplicateName } });

  if (!primary) {
    console.error(`Primary shop '${primaryName}' not found; abort.`);
    return;
  }
  if (!duplicate) {
    console.log(`Duplicate shop '${duplicateName}' not found; nothing to do.`);
    return;
  }

  const keepId = primary.id;
  const dupId = duplicate.id;
  console.log(`Keeping '${primaryName}' (${keepId}); migrating & removing '${duplicateName}' (${dupId}).`);

  // Helper for simple updateMany migrations
  async function migrateSimple(model: string, fn: () => Promise<any>) {
    try {
      const res = await fn();
      console.log(`Migrated ${model}:`, res?.count ?? "ok");
    } catch (e: any) {
      console.warn(`WARN migrating ${model}:`, e.message || String(e));
    }
  }

  // Orders & related simple foreign key tables
  await migrateSimple("Order", () => prisma.order.updateMany({ where: { shopId: dupId }, data: { shopId: keepId } }));
  await migrateSimple("SettlementRow", () => prisma.settlementRow.updateMany({ where: { shopId: dupId }, data: { shopId: keepId } }));
  await migrateSimple("CostCatalog", () => prisma.costCatalog.updateMany({ where: { shopId: dupId }, data: { shopId: keepId } }));
  await migrateSimple("Reconciliation", () => prisma.reconciliation.updateMany({ where: { shopId: dupId }, data: { shopId: keepId } }));
  await migrateSimple("Discrepancy", () => prisma.discrepancy.updateMany({ where: { shopId: dupId }, data: { shopId: keepId } }));
  await migrateSimple("FulfillmentAudit", () => prisma.fulfillmentAudit.updateMany({ where: { shopId: dupId }, data: { shopId: keepId } }));
  await migrateSimple("ReturnCase", () => prisma.returnCase.updateMany({ where: { shopId: dupId }, data: { shopId: keepId } }));
  await migrateSimple("CommissionRule", () => prisma.commissionRule.updateMany({ where: { shopId: dupId }, data: { shopId: keepId } }));
  await migrateSimple("AttendantCommission", () => prisma.attendantCommission.updateMany({ where: { shopId: dupId }, data: { shopId: keepId } }));
  await migrateSimple("CatalogCounters", () => prisma.catalogCounters.updateMany({ where: { shopId: dupId }, data: { shopId: keepId } }));

  // ApiCredential (unique scope+shopId) & ShopApiConfig (unique shopId)
  try {
    const creds = await prisma.apiCredential.findMany({ where: { shopId: dupId } });
    for (const c of creds) {
      if (!c.scope || c.scope.startsWith("GLOBAL")) {
        // global scope unaffected
        continue;
      }
      // If a credential row already exists for keepId with same scope, drop duplicate
      const existing = await prisma.apiCredential.findFirst({ where: { scope: c.scope, shopId: keepId } });
      if (existing) {
        await prisma.apiCredential.delete({ where: { id: c.id } });
        console.log(`Deleted duplicate ApiCredential ${c.id} scope=${c.scope}`);
      } else {
        await prisma.apiCredential.update({ where: { id: c.id }, data: { shopId: keepId } });
        console.log(`Migrated ApiCredential ${c.id} -> keep shop`);
      }
    }
  } catch (e: any) {
    console.warn("WARN migrating ApiCredential:", e.message || String(e));
  }

  try {
    const cfg = await prisma.shopApiConfig.findFirst({ where: { shopId: dupId } });
    if (cfg) {
      const existingCfg = await prisma.shopApiConfig.findFirst({ where: { shopId: keepId } });
      if (existingCfg) {
        await prisma.shopApiConfig.delete({ where: { id: cfg.id } });
        console.log(`Deleted duplicate ShopApiConfig ${cfg.id}`);
      } else {
        await prisma.shopApiConfig.update({ where: { id: cfg.id }, data: { shopId: keepId } });
        console.log(`Migrated ShopApiConfig ${cfg.id}`);
      }
    }
  } catch (e: any) {
    console.warn("WARN migrating ShopApiConfig:", e.message || String(e));
  }

  // UserShop (unique userId+shopId) and ShopAssignment (unique userId+shopId+role)
  try {
    const userShops = await prisma.userShop.findMany({ where: { shopId: dupId } });
    for (const us of userShops) {
      const conflict = await prisma.userShop.findFirst({ where: { userId: us.userId, shopId: keepId } });
      if (conflict) {
        await prisma.userShop.delete({ where: { id: us.id } });
        console.log(`Deleted duplicate UserShop ${us.id}`);
      } else {
        await prisma.userShop.update({ where: { id: us.id }, data: { shopId: keepId } });
        console.log(`Migrated UserShop ${us.id}`);
      }
    }
  } catch (e: any) {
    console.warn("WARN migrating UserShop:", e.message || String(e));
  }

  try {
    const assignments = await prisma.shopAssignment.findMany({ where: { shopId: dupId } });
    for (const a of assignments) {
      const conflict = await prisma.shopAssignment.findFirst({ where: { userId: a.userId, shopId: keepId, role: a.role } });
      if (conflict) {
        await prisma.shopAssignment.delete({ where: { id: a.id } });
        console.log(`Deleted duplicate ShopAssignment ${a.id}`);
      } else {
        await prisma.shopAssignment.update({ where: { id: a.id }, data: { shopId: keepId } });
        console.log(`Migrated ShopAssignment ${a.id}`);
      }
    }
  } catch (e: any) {
    console.warn("WARN migrating ShopAssignment:", e.message || String(e));
  }

  // Final delete of duplicate shop
  try {
    await prisma.shop.delete({ where: { id: dupId } });
    console.log(`Deleted duplicate shop '${duplicateName}' (${dupId}).`);
  } catch (e: any) {
    console.error("FAILED to delete duplicate shop:", e.message || String(e));
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().then(() => process.exit(1));
  });
