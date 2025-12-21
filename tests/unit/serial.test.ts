import { generateReceiptSerial, normalizeReceiptSerial } from "@/lib/receipts/serial";

describe("receipt serial helpers", () => {
  test("generateReceiptSerial produces Betech- prefix and date", () => {
    const s = generateReceiptSerial();
    expect(s.startsWith("Betech-")).toBe(true);
    // ensure pattern like Betech-YYYYMMDD-
    expect(/Betech-\d{8}-\d{5}/.test(s)).toBe(true);
  });

  test("normalizeReceiptSerial enforces Betech prefix", () => {
    expect(normalizeReceiptSerial("12345")).toMatch(/^Betech-/);
    expect(normalizeReceiptSerial("Betech-20250101-00001")).toBe("Betech-20250101-00001");
    expect(normalizeReceiptSerial("BETECH-20250101-00001")).toMatch(/^Betech/);
  });
});
