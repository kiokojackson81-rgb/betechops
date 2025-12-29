import 'dotenv/config';
import { prisma } from "../src/lib/prisma";

async function main() {
  const arg = process.argv[2];
  const receiptNumber = arg || "BETECH2025122841139";

  if (!receiptNumber) {
    console.error("Usage: ts-node scripts/delete-support-receipts-by-number.ts <RECEIPT_NUMBER>");
    process.exit(1);
  }

  const result = await prisma.supportReceipt.deleteMany({ where: { receiptNumber } });
  console.log("Deleted support receipts count:", result.count, "for receiptNumber:", receiptNumber);
}

main()
  .catch((err) => {
    console.error("Failed to delete receipt", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
