jest.mock("@/lib/prisma", () => ({ prisma: { receipt: { findUnique: jest.fn(), update: jest.fn() }, $transaction: jest.fn() } }));
jest.mock("@/lib/api", () => ({ requireRole: jest.fn() }));
jest.mock("@/lib/auth", () => ({ auth: jest.fn().mockResolvedValue({ user: { id: "admin", attendantCategory: "TECHNICAL" } }) }));
jest.mock("@/lib/technicalTeam", () => ({ isTechnicalTeamCategory: () => true }));
jest.mock("@/lib/commissioningAssignments", () => ({ syncCommissioningAssignment: jest.fn() }));
jest.mock("@/lib/commissioning", () => ({ decryptCommissioningToken: jest.fn(), commissioningUrl: jest.fn() }));
jest.mock("@/lib/posCustomerAccountSync", () => ({ syncPosReceiptToCustomerAccount: jest.fn().mockResolvedValue({}) }));
jest.mock("@/lib/reviewsReferrals", () => ({ ensureReviewInvitationForReceipt: jest.fn().mockResolvedValue({}) }));
jest.mock("@/lib/projectPricingSync", () => ({ syncCompletedProjectReceiptToPricing: jest.fn() }));
jest.mock("@/services/project-notifications/project-notification.service", () => ({ publishProjectNotification: jest.fn() }));
jest.mock("@/services/project-notifications/project-notification.logic", () => ({ hasProjectBookingDate: () => false, resolveProjectNotificationEvents: () => [], shouldSendProjectAssigned: () => false, shouldSendProjectBooked: () => false }));
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/receipts/[id]/project/route";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { buildReceiptProjectFlow } from "@/lib/receiptProjects";
function request(body: object) { return new NextRequest("https://example.invalid/api/receipts/r/project", { method: "PATCH", body: JSON.stringify(body) }); }
const context = { params: Promise.resolve({ id: "r" }) };
beforeEach(() => {
  jest.clearAllMocks();
  (requireRole as jest.Mock).mockResolvedValue({ ok: true, role: "ADMIN" });
  (prisma.receipt.findUnique as jest.Mock).mockResolvedValue({ id: "r", issuedById: "admin", totals: { total: 100000, balance: 70000 }, commissioningSession: { status: "ISSUED" }, order: { totalAmount: 100000, paidAmount: 30000, status: "PENDING" }, data: { customerType: "project", projectFlow: buildReceiptProjectFlow({ projectValue: 100000, amountPaidTotal: 30000, depositPaidAmount: 30000, stage: "PROJECT_IN_PROGRESS" }) } });
  (prisma.$transaction as jest.Mock).mockImplementation(async fn => fn(prisma));
  (prisma.receipt.update as jest.Mock).mockImplementation(async ({ data }) => ({ id: "r", ...data }));
});
test("stage alone cannot settle an unpaid project", async () => {
  const response = await PATCH(request({ stage: "COMPLETED_POSTED" }), context);
  expect(response.status).toBe(409);
  expect(prisma.receipt.update).not.toHaveBeenCalled();
});
test("admin can settle a certified project directly from its preserved stage", async () => {
  const response = await PATCH(request({ stage: "COMPLETED_POSTED", confirmBalanceCleared: true }), context);
  expect(response.status).toBe(200);
  const data = (prisma.receipt.update as jest.Mock).mock.calls[0][0].data;
  expect(data.order.update).toMatchObject({ paidAmount: 100000, paymentStatus: "PAID", status: "COMPLETED" });
  expect(data.data.adminPaymentConfirmation).toMatchObject({ actorId: "admin", amountReceived: 70000 });
  expect(data.totals.balance).toBe(0);
});
test("attendants cannot use admin completion to clear a balance", async () => {
  (requireRole as jest.Mock).mockResolvedValue({ ok: true, role: "ATTENDANT" });
  expect((await PATCH(request({ stage: "COMPLETED_POSTED", confirmBalanceCleared: true }), context)).status).toBe(403);
  expect(prisma.receipt.update).not.toHaveBeenCalled();
});
test("recording a partial payment preserves the project stage and remaining balance", async () => {
  expect((await PATCH(request({ balancePaidAmount: 20000 }), context)).status).toBe(200);
  const data = (prisma.receipt.update as jest.Mock).mock.calls[0][0].data;
  expect(data.order.update).toMatchObject({ paidAmount: 50000, paymentStatus: "PARTIAL", status: "PENDING" });
  expect(data.data.projectFlow.stage).toBe("PROJECT_IN_PROGRESS");
  expect(data.totals.balance).toBe(50000);
});
