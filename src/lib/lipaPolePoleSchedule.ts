export type LppInstallmentLike = {
  dueDate: string;
  expectedAmount: number;
};

export function getNextLppInstallment(
  installments: readonly LppInstallmentLike[],
  totalPaid: number,
) {
  let unappliedPayment = Math.max(0, Number(totalPaid || 0));
  const ordered = [...installments].sort(
    (left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime(),
  );

  for (const installment of ordered) {
    const expectedAmount = Math.max(0, Number(installment.expectedAmount || 0));
    if (unappliedPayment >= expectedAmount) {
      unappliedPayment -= expectedAmount;
      continue;
    }
    return {
      dueDate: installment.dueDate,
      amount: Math.max(0, expectedAmount - unappliedPayment),
    };
  }

  return null;
}
