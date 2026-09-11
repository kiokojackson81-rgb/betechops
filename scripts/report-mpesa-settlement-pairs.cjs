// Read-only production-safe diagnostic. It never writes payment/order rows.
// Run: node -r ts-node/register -r tsconfig-paths/register scripts/report-mpesa-settlement-pairs.cjs
require("ts-node/register");
require("tsconfig-paths/register");

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { PrismaClient } = require("@prisma/client");
const { isSettledMpesaPayment, summarizeMpesaSettlements } = require("../src/lib/mpesaSettlements");
const prisma = new PrismaClient();

(async () => {
  if (process.argv.includes("--apply")) {
    throw new Error("This report is intentionally read-only; --apply is not supported.");
  }
  const payments = await prisma.mpesaPayment.findMany({
    where: { status: "SUCCESS" },
    select: {
      id: true,
      channel: true,
      status: true,
      amount: true,
      receiptNumber: true,
      transactionId: true,
      accountReference: true,
      orderId: true,
      websiteOrderId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const settlementSummary = summarizeMpesaSettlements(payments);
  const correlatedStkEvents = payments.filter((payment) => payment.channel === "STK" && !isSettledMpesaPayment(payment));
  console.table({
    successLedgerRows: payments.length,
    uniqueSettledReceipts: settlementSummary.successfulCount,
    settledAmount: settlementSummary.totalReceived,
    correlatedStkAuditEvents: correlatedStkEvents.length,
    proposedWrites: 0,
  });
  if (correlatedStkEvents.length) {
    console.table(correlatedStkEvents.map((payment) => ({
      paymentId: payment.id,
      reference: payment.accountReference,
      amount: Number(payment.amount || 0),
      orderId: payment.orderId,
      websiteOrderId: payment.websiteOrderId,
      createdAt: payment.createdAt.toISOString(),
      action: "Keep as audit event; exclude from settled totals",
    })));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
