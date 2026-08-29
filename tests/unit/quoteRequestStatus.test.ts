import {
  getQuoteRequestStatusAliases,
  normalizeQuoteRequestStatus,
  QUOTE_REQUEST_ACTIONABLE_STATUSES,
} from "@/lib/quoteRequestStatus";

describe("quotation request statuses", () => {
  it("preserves contacted as a distinct completed triage state", () => {
    expect(normalizeQuoteRequestStatus("CONTACTED")).toBe("CONTACTED");
    expect(getQuoteRequestStatusAliases("PENDING")).not.toContain("CONTACTED");
    expect(QUOTE_REQUEST_ACTIONABLE_STATUSES).not.toContain("CONTACTED");
  });

  it("retains legacy aliases for pending and quoted requests", () => {
    expect(normalizeQuoteRequestStatus("NEW")).toBe("PENDING");
    expect(normalizeQuoteRequestStatus("SENT")).toBe("QUOTED");
  });
});
