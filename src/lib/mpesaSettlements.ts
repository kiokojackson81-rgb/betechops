/**
 * A ledger row is financially settled only when it owns a Safaricom receipt
 * (or transaction ID).  Correlated STK rows deliberately have neither: they
 * are useful attempt/callback audit history, but must never be added to money
 * received, paid amounts, or receipt counts.
 */
export type MpesaSettlementRecord = {
  status: string;
  receiptNumber?: string | null;
  transactionId?: string | null;
  amount?: unknown;
};

function amountOf(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export function isSettledMpesaPayment(payment: MpesaSettlementRecord) {
  return payment.status === "SUCCESS" && Boolean(payment.receiptNumber || payment.transactionId);
}

export function settlementKey(payment: MpesaSettlementRecord) {
  return payment.receiptNumber || payment.transactionId || null;
}

export function summarizeMpesaSettlements(payments: MpesaSettlementRecord[]) {
  const unique = new Map<string, MpesaSettlementRecord>();
  for (const payment of payments) {
    const key = settlementKey(payment);
    if (isSettledMpesaPayment(payment) && key && !unique.has(key)) unique.set(key, payment);
  }
  return Array.from(unique.values()).reduce(
    (summary, payment) => ({
      totalReceived: summary.totalReceived + amountOf(payment.amount),
      successfulCount: summary.successfulCount + 1,
    }),
    { totalReceived: 0, successfulCount: 0 },
  );
}
