import { buildOpenfloatReviewRow } from "@/lib/payrollOpenfloatShared";
import { buildCashAdvanceOpenfloatRow } from "@/lib/cashAdvanceOpenfloat";

describe("buildOpenfloatReviewRow", () => {
  const period = {
    key: "2026-06-25_2026-07-24",
    label: "25 Jun 2026 - 24 Jul 2026",
    start: new Date("2026-06-25T00:00:00.000Z"),
    end: new Date("2026-07-24T23:59:59.999Z"),
  };

  test("maps M-Pesa payout details into Openfloat columns", () => {
    const row = buildOpenfloatReviewRow(
      {
        id: "u1",
        name: "Jeniffer",
        email: "jeniffer@betech.co.ke",
        attendantCategory: "MARKETING_OPS",
        isActive: true,
        bankName: null,
        bankAccountNumber: null,
        payoutMethod: "MPESA",
        payoutAccountName: "Jeniffer",
        mobileMoneyPhoneNumber: "254700111222",
        tillPaybillNumber: null,
        tillPaybillBusinessName: null,
        paybillAccountNumber: null,
        notificationPhoneNumber: "254700111222",
      },
      124479,
      period,
    );

    expect(row.accountType).toBe("Mpesa");
    expect(row.accountNumber).toBe("254700111222");
    expect(row.amount).toBe(124479);
    expect(row.isValid).toBe(true);
    expect(row.isSkipped).toBe(false);
  });

  test("reports missing fields for bank payouts", () => {
    const row = buildOpenfloatReviewRow(
      {
        id: "u2",
        name: "Brian",
        email: "brian@betech.co.ke",
        attendantCategory: "SUPPORT_OPS",
        isActive: true,
        bankName: null,
        bankAccountNumber: null,
        payoutMethod: "BANK",
        payoutAccountName: "",
        mobileMoneyPhoneNumber: null,
        tillPaybillNumber: null,
        tillPaybillBusinessName: null,
        paybillAccountNumber: null,
        notificationPhoneNumber: "",
      },
      83000,
      period,
    );

    expect(row.isValid).toBe(false);
    expect(row.isSkipped).toBe(false);
    expect(row.validationErrors).toEqual(
      expect.arrayContaining([
        "Missing notification phone number",
        "Missing bank account number",
        "Missing bank name",
      ]),
    );
  });

  test("skips negative payroll balances from the export file", () => {
    const row = buildOpenfloatReviewRow(
      {
        id: "u3",
        name: "Stephen",
        email: "stephen@betech.co.ke",
        attendantCategory: "JUMIA_KILIMALL_OPS",
        isActive: true,
        bankName: null,
        bankAccountNumber: null,
        payoutMethod: "MPESA",
        payoutAccountName: "Stephen",
        mobileMoneyPhoneNumber: "254700333444",
        tillPaybillNumber: null,
        tillPaybillBusinessName: null,
        paybillAccountNumber: null,
        notificationPhoneNumber: "254700333444",
      },
      -1500,
      period,
    );

    expect(row.isSkipped).toBe(true);
    expect(row.skipReason).toBe("Negative payroll balance");
    expect(row.validationErrors).toEqual([]);
  });

  test("uses the validated payout profile and a cash-advance remark", () => {
    const row = buildCashAdvanceOpenfloatRow(
      {
        id: "cash-advance-123",
        approvedAmount: 20000,
        user: {
          id: "u4",
          name: "Jonathan Mugira",
          email: "jonathan@betech.co.ke",
          attendantCategory: "MARKETING_OPS",
          isActive: true,
          bankName: null,
          bankAccountNumber: null,
          payoutMethod: "MPESA",
          payoutAccountName: "Jonathan Mugira",
          mobileMoneyPhoneNumber: "254722607174",
          tillPaybillNumber: null,
          tillPaybillBusinessName: null,
          paybillAccountNumber: null,
          notificationPhoneNumber: "254722607174",
        },
      },
      period,
    );

    expect(row.amount).toBe(20000);
    expect(row.accountType).toBe("Mpesa");
    expect(row.remark).toBe("Cash advance cash-advance-123 2026-06-25_2026-07-24");
    expect(row.isValid).toBe(true);
  });
});
