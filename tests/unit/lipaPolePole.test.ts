import { Prisma } from "@prisma/client";
import {
  assertLppEligibleForConversion,
  assertLppEligibleForRelease,
  buildLppReminderIdempotencyKey,
  computeLppFinancialSummary,
  deriveLppOperationalStatus,
  generateLppReference,
} from "@/lib/lipaPolePole";

describe("lipaPolePole domain rules", () => {
  test("computes balance strictly from successful payments", () => {
    const summary = computeLppFinancialSummary({
      agreedTotal: new Prisma.Decimal("280000"),
      payments: [
        { amount: new Prisma.Decimal("50000"), status: "SUCCESS" },
        { amount: new Prisma.Decimal("30000"), status: "SUCCESS" },
        { amount: new Prisma.Decimal("200000"), status: "PENDING" },
      ],
    });

    expect(summary.totalPaid.toString()).toBe("80000");
    expect(summary.balance.toString()).toBe("200000");
    expect(summary.percentagePaid.toString()).toBe("28.57");
    expect(summary.isFullyPaid).toBe(false);
  });

  test("marks full payment without allowing balance below zero", () => {
    const summary = computeLppFinancialSummary({
      agreedTotal: "280000",
      payments: [
        { amount: "50000", status: "SUCCESS" },
        { amount: "30000", status: "SUCCESS" },
        { amount: "200000", status: "SUCCESS" },
        { amount: "10000", status: "SUCCESS" },
      ],
    });

    expect(summary.totalPaid.toString()).toBe("290000");
    expect(summary.balance.toString()).toBe("0");
    expect(summary.percentagePaid.toString()).toBe("100");
    expect(summary.isFullyPaid).toBe(true);
  });

  test("derives overdue vs awaiting conversion correctly", () => {
    const overdue = deriveLppOperationalStatus({
      currentStatus: "ACTIVE",
      agreedTotal: "280000",
      payments: [{ amount: "50000", status: "SUCCESS" }],
      expectedCompletionDate: "2026-08-01T00:00:00.000Z",
      now: new Date("2026-08-14T00:00:00.000Z"),
    });

    const awaitingConversion = deriveLppOperationalStatus({
      currentStatus: "COMPLETED",
      agreedTotal: "280000",
      payments: [{ amount: "280000", status: "SUCCESS" }],
      expectedCompletionDate: "2026-09-01T00:00:00.000Z",
      now: new Date("2026-08-14T00:00:00.000Z"),
    });

    expect(overdue).toBe("OVERDUE");
    expect(awaitingConversion).toBe("COMPLETED");
  });

  test("activates a draft account after the first verified deposit", () => {
    expect(deriveLppOperationalStatus({
      currentStatus: "DRAFT",
      agreedTotal: "280000",
      payments: [{ amount: "500", status: "SUCCESS" }],
      expectedCompletionDate: "2026-09-16T00:00:00.000Z",
      now: new Date("2026-08-16T00:00:00.000Z"),
    })).toBe("ACTIVE");

    expect(deriveLppOperationalStatus({
      currentStatus: "DRAFT",
      agreedTotal: "280000",
      payments: [{ amount: "500", status: "PENDING" }],
      expectedCompletionDate: "2026-09-16T00:00:00.000Z",
      now: new Date("2026-08-16T00:00:00.000Z"),
    })).toBe("DRAFT");
  });

  test("blocks conversion until fully paid and only once", () => {
    expect(() =>
      assertLppEligibleForConversion({
        status: "ACTIVE",
        agreedTotal: "280000",
        payments: [{ amount: "50000", status: "SUCCESS" }],
      }),
    ).toThrow("LPP_BALANCE_NOT_ZERO");

    expect(() =>
      assertLppEligibleForConversion({
        status: "AWAITING_CONVERSION",
        agreedTotal: "280000",
        payments: [{ amount: "280000", status: "SUCCESS" }],
        convertedReceiptId: "receipt-1",
      }),
    ).toThrow("LPP_ALREADY_CONVERTED");
  });

  test("enforces product release security", () => {
    expect(() =>
      assertLppEligibleForRelease({
        agreedTotal: "280000",
        payments: [{ amount: "280000", status: "SUCCESS" }],
        converted: false,
        transactionFullyPaid: true,
      }),
    ).toThrow("PRODUCT_NOT_ELIGIBLE_FOR_RELEASE");

    expect(() =>
      assertLppEligibleForRelease({
        agreedTotal: "280000",
        payments: [{ amount: "280000", status: "SUCCESS" }],
        converted: true,
        transactionFullyPaid: true,
      }),
    ).not.toThrow();
  });

  test("formats stable references and reminder idempotency keys", () => {
    expect(generateLppReference({
      date: new Date("2026-08-14T00:00:00.000Z"),
      sequence: 145,
    })).toBe("LPP-2026-000145");

    expect(buildLppReminderIdempotencyKey({
      lppId: "lpp-1",
      reminderType: "due_date",
      dueDate: "2026-09-14T10:15:00.000Z",
      channel: "sms",
    })).toBe("lpp-1:DUE_DATE:SMS:2026-09-14");
  });
});
