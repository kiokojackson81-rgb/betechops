jest.mock("server-only", () => ({}), { virtual: true });

import {
  assertLppEligibleForPermanentDelete,
  pickNextRoundRobinAgent,
} from "@/lib/lipaPolePoleService";

describe("lipaPolePoleService", () => {
  test("round robin starts from the first sorted eligible agent", () => {
    const next = pickNextRoundRobinAgent(
      [
        { id: "b", name: "Jeniffer", email: "jeniffer@betech.co.ke", role: "ATTENDANT", attendantCategory: "BETECH_OPS" },
        { id: "a", name: "Breadh", email: "breadh@betech.co.ke", role: "ATTENDANT", attendantCategory: "BETECH_OPS" },
      ],
      null,
    );

    expect(next.id).toBe("a");
  });

  test("round robin advances to the next eligible agent", () => {
    const next = pickNextRoundRobinAgent(
      [
        { id: "a", name: "Breadh", email: "breadh@betech.co.ke", role: "ATTENDANT", attendantCategory: "BETECH_OPS" },
        { id: "b", name: "Jeniffer", email: "jeniffer@betech.co.ke", role: "ATTENDANT", attendantCategory: "BETECH_OPS" },
        { id: "c", name: "Mercy", email: "mercy@betech.co.ke", role: "ATTENDANT", attendantCategory: "BETECH_OPS" },
      ],
      "b",
    );

    expect(next.id).toBe("c");
  });

  test("round robin wraps when the previous agent was the last one", () => {
    const next = pickNextRoundRobinAgent(
      [
        { id: "a", name: "Breadh", email: "breadh@betech.co.ke", role: "ATTENDANT", attendantCategory: "BETECH_OPS" },
        { id: "b", name: "Jeniffer", email: "jeniffer@betech.co.ke", role: "ATTENDANT", attendantCategory: "BETECH_OPS" },
      ],
      "b",
    );

    expect(next.id).toBe("a");
  });

  test("permanent delete requires the exact LPP reference", () => {
    expect(() =>
      assertLppEligibleForPermanentDelete({
        reference: "LPP-2026-000123",
        confirmation: "LPP-2026-000124",
      }),
    ).toThrow("LPP_DELETE_CONFIRMATION_MISMATCH");
  });

  test("permanent delete blocks converted or fulfilled accounts", () => {
    expect(() =>
      assertLppEligibleForPermanentDelete({
        reference: "LPP-2026-000123",
        confirmation: "LPP-2026-000123",
        convertedReceiptId: "receipt-1",
      }),
    ).toThrow("LPP_DELETE_LINKED_TRANSACTION");
  });

  test("permanent delete accepts an unconverted test account", () => {
    expect(() =>
      assertLppEligibleForPermanentDelete({
        reference: "LPP-2026-000123",
        confirmation: "LPP-2026-000123",
      }),
    ).not.toThrow();
  });

  test("forced test deletion still blocks converted accounts", () => {
    expect(() =>
      assertLppEligibleForPermanentDelete({
        reference: "LPP-2026-000123",
        confirmation: "LPP-2026-000123",
        convertedReceiptId: "receipt-1",
        forceTestDeletion: true,
        reason: "Remove test account",
      }),
    ).toThrow("LPP_DELETE_LINKED_TRANSACTION");
  });

  test("fulfilled test deletion requires an explicit test reason", () => {
    expect(() =>
      assertLppEligibleForPermanentDelete({
        reference: "LPP-2026-000123",
        confirmation: "LPP-2026-000123",
        fulfilledAt: new Date(),
        forceTestDeletion: true,
        reason: "Cleanup",
      }),
    ).toThrow("LPP_FORCE_DELETE_REASON_REQUIRED");

    expect(() =>
      assertLppEligibleForPermanentDelete({
        reference: "LPP-2026-000123",
        confirmation: "LPP-2026-000123",
        fulfilledAt: new Date(),
        forceTestDeletion: true,
        reason: "Remove confirmed test booking",
      }),
    ).not.toThrow();
  });
});
