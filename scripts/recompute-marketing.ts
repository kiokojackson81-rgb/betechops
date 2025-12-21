async function main() {
  const email = process.env.USER_EMAIL || process.argv[2] || "brendah@betech.co.ke";
  console.log(`Recompute marketing commission ledger for email=${email}`);

  // Dynamically import modules to avoid ESM/CJS resolution cycles when
  // running via ts-node in different loader modes.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`User not found for email=${email}`);
      process.exitCode = 2;
      return;
    }

    const mod = await import("../src/lib/marketingPeriodTotals.ts");
    const recompute = mod.recomputeMarketingCommissionLedger as (
      opts: any,
    ) => Promise<any>;

    const res = await recompute({ userId: user.id });
    console.log("Recompute result:", res);
  } catch (e) {
    console.error("Recompute failed:", e);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch (_) {}
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
