import {
  extractMpesaTransactionCode,
  formatMpesaReferenceInput,
  normalizeLppPaymentReference,
} from "@/lib/mpesaReference";

describe("M-Pesa reference parsing", () => {
  it("keeps a direct transaction code", () => {
    expect(extractMpesaTransactionCode("UHG3K3STB0")).toBe("UHG3K3STB0");
  });

  it("extracts the code from a full confirmation message", () => {
    expect(extractMpesaTransactionCode("UHG3K3STB0 Confirmed. Ksh500.00 sent to BETECH SOLAR on 16/8/26."))
      .toBe("UHG3K3STB0");
  });

  it("does not mistake a phone number for a transaction code", () => {
    expect(extractMpesaTransactionCode("254705663175")).toBeNull();
  });

  it("collapses pasted messages to the code for the form", () => {
    expect(formatMpesaReferenceInput("uhg3k3stb0 Confirmed. Ksh500 paid"))
      .toBe("UHG3K3STB0");
  });

  it("normalizes every LPP M-Pesa payment to the transaction code", () => {
    expect(normalizeLppPaymentReference(
      "MPESA",
      "uhg3k3stb0 Confirmed. Ksh500 paid",
    )).toBe("UHG3K3STB0");
  });

  it("rejects an invalid LPP M-Pesa reference", () => {
    expect(() => normalizeLppPaymentReference("MPESA", "full message without a code"))
      .toThrow("INVALID_MPESA_REFERENCE");
  });

  it("requires references for non-cash electronic payments", () => {
    expect(() => normalizeLppPaymentReference("BANK", ""))
      .toThrow("PAYMENT_REFERENCE_REQUIRED");
    expect(normalizeLppPaymentReference("CASH", "")).toBeNull();
  });
});
