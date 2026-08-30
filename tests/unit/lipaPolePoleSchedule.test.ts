import { getNextLppInstallment } from "@/lib/lipaPolePoleSchedule";

describe("Lipa Pole Pole installment schedule", () => {
  const installments = [
    { dueDate: "2026-09-16T00:00:00.000Z", expectedAmount: 1000 },
    { dueDate: "2026-10-16T00:00:00.000Z", expectedAmount: 1000 },
  ];

  it("applies verified payments to the earliest installment", () => {
    expect(getNextLppInstallment(installments, 500)).toEqual({
      dueDate: "2026-09-16T00:00:00.000Z",
      amount: 500,
    });
  });

  it("moves to the next installment after the first is covered", () => {
    expect(getNextLppInstallment(installments, 1250)).toEqual({
      dueDate: "2026-10-16T00:00:00.000Z",
      amount: 750,
    });
  });

  it("returns the outstanding part of a partially paid installment", () => {
    expect(
      getNextLppInstallment(
        [{ dueDate: "2026-09-30T00:00:00.000Z", expectedAmount: 3667 }],
        500,
      ),
    ).toEqual({
      dueDate: "2026-09-30T00:00:00.000Z",
      amount: 3167,
    });
  });
});
