import { normalizeReceiptId } from "../src/lib/receiptKey";

const samples = [
  " betech-20251226-86468 ",
  "BETECH-20251226-86468",
  "betech-20251226-86468",
];

console.log("Canonical receipt IDs:");
for (const sample of samples) {
  console.log(`${sample} -> ${normalizeReceiptId(sample)}`);
}
