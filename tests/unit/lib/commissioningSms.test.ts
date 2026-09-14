jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({ prisma: { commissioningSmsLog: { upsert: jest.fn(), updateMany: jest.fn(), update: jest.fn() } } }));
jest.mock("@/lib/africasTalking", () => ({ sendTransactionalSms: jest.fn() }));
import { prisma } from "@/lib/prisma";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { sendCommissioningSms } from "@/lib/commissioningSms";

const input = { sessionId: "s", kind: "TECHNICIAN_LINK" as const, recipientName: "Samuel", phone: "0722000000", message: "test", automaticKey: "assignment:s:token" };
beforeEach(() => { jest.clearAllMocks(); (prisma.commissioningSmsLog.upsert as jest.Mock).mockResolvedValue({ id: "log", status: "PENDING" }); (prisma.commissioningSmsLog.updateMany as jest.Mock).mockResolvedValue({ count: 1 }); });

test("a repeated automatic assignment never sends another SMS", async () => {
  (prisma.commissioningSmsLog.upsert as jest.Mock).mockResolvedValue({ id: "log", status: "SENT" });
  (prisma.commissioningSmsLog.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
  expect((await sendCommissioningSms(input)).reused).toBe(true);
  expect(sendTransactionalSms).not.toHaveBeenCalled();
});

test("provider failures are recorded as failed, not sent", async () => {
  (sendTransactionalSms as jest.Mock).mockRejectedValue(new Error("Provider rejected SMS"));
  expect((await sendCommissioningSms(input)).status).toBe("FAILED");
  expect(prisma.commissioningSmsLog.update).toHaveBeenCalledWith({ where: { id: "log" }, data: { status: "FAILED", error: "Provider rejected SMS" } });
});

test("missing phone numbers create actionable history without contacting the provider", async () => {
  expect((await sendCommissioningSms({ ...input, phone: "" })).status).toBe("FAILED");
  expect(sendTransactionalSms).not.toHaveBeenCalled();
});

test("manual resends are distinct attempts and store the gateway message ID", async () => {
  (sendTransactionalSms as jest.Mock).mockResolvedValue({ SMSMessageData: { Recipients: [{ messageId: "gateway-id" }] } });
  await sendCommissioningSms({ ...input, manual: true });
  await sendCommissioningSms({ ...input, manual: true });
  const calls = (prisma.commissioningSmsLog.upsert as jest.Mock).mock.calls;
  expect(calls[0][0].where.idempotencyKey).not.toBe(calls[1][0].where.idempotencyKey);
  expect(prisma.commissioningSmsLog.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SENT", providerId: "gateway-id" }) }));
});
