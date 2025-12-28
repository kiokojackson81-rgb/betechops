#!/usr/bin/env ts-node
import { prisma } from "../src/lib/prisma";
import { buildReceiptKey } from "../src/lib/receiptKey";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

  console.log(`backfill-receiptKey: mode=${apply ? "APPLY" : "DRY-RUN"} limit=${limit ?? "ALL"}`);

  const models: { name: string; prop: string }[] = [
    { name: "MarketingReceipt", prop: "marketingReceipt" },
    { name: "SupportReceipt", prop: "supportReceipt" },
  ];

  for (const m of models) {
    console.log(`\nProcessing model ${m.name}`);
    const client: any = prisma as any;

    const where = { receiptKey: null };
    const rows: Array<{ id: string; receiptNumber?: string | null; paymentMethod?: string | null }> =
      await client[m.prop].findMany({ where, select: { id: true, receiptNumber: true, paymentMethod: true }, take: limit });

    console.log(`Found ${rows.length} rows without receiptKey`);
    const updates: { id: string; key: string }[] = [];
    const conflicts: { id: string; key: string; conflictWithId: string }[] = [];
    const seenKeys = new Map<string, string>();

    for (const r of rows) {
      const key = buildReceiptKey(r.receiptNumber ?? null, r.id);
      if (!key) continue;

      // If another row in this batch already produced the same key, mark conflict
      const prev = seenKeys.get(key);
      if (prev && prev !== r.id) {
        conflicts.push({ id: r.id, key, conflictWithId: prev });
        continue;
      }

      // Check existing row with this receiptKey in DB
      const existing = await client[m.prop].findFirst({ where: { receiptKey: key }, select: { id: true } });
      if (existing && existing.id !== r.id) {
        conflicts.push({ id: r.id, key, conflictWithId: existing.id });
        continue;
      }

      seenKeys.set(key, r.id);
      updates.push({ id: r.id, key });
    }

    console.log(`Prepared ${updates.length} updates, ${conflicts.length} conflicts`);
    if (conflicts.length > 0) {
      console.log("Sample conflicts:", conflicts.slice(0, 10));
    }

    if (updates.length > 0) {
      console.log("Sample updates:", updates.slice(0, 10));
    }

    if (!apply) {
      console.log(`DRY-RUN complete for ${m.name}. Use --apply to execute updates.`);
      continue;
    }

    if (conflicts.length > 0) {
      console.error("Aborting apply due to detected conflicts. Resolve duplicates before running --apply.");
      process.exitCode = 2;
      return;
    }

    console.log(`Applying ${updates.length} updates to ${m.name}...`);
    const tx = await prisma.$transaction(
      updates.map((u) => client[m.prop].update({ where: { id: u.id }, data: { receiptKey: u.key } })),
    );
    console.log(`Applied ${tx.length} updates to ${m.name}`);
  }

  console.log("Backfill completed.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
