jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({ prisma: { commissioningSession: { findUnique: jest.fn(), update: jest.fn() }, user: { findMany: jest.fn() }, projectExternalAgent: { findMany: jest.fn() } } }));
jest.mock("@/lib/commissioningSms", () => ({ sendCommissioningSms: jest.fn().mockResolvedValue({ status: "SENT" }) }));
import { prisma } from "@/lib/prisma";
import { encryptCommissioningToken } from "@/lib/commissioning";
import { technicianMessagePreview, sendTechnicianCommissioningLink } from "@/lib/commissioningAssignments";
import { sendCommissioningSms } from "@/lib/commissioningSms";
beforeEach(() => {
  jest.clearAllMocks(); process.env.COMMISSIONING_LINK_ENCRYPTION_SECRET = "test-only-key";
  (prisma.commissioningSession.findUnique as jest.Mock).mockResolvedValue({ id: "session", status: "DRAFT", technicianId: null, assignment: { staffIds: [], externalAgentIds: ["jackson"] }, tokenHash: "hash", tokenCiphertext: encryptCommissioningToken("public-agent-token"), expiresAt: new Date("2099-01-01"), receipt: { receiptNumber: "PROJECT-TEST", data: { county: "Nairobi" }, order: { orderNumber: "ORDER-TEST", customerName: "Test Customer" } } });
  (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.projectExternalAgent.findMany as jest.Mock).mockResolvedValue([{ id: "jackson", name: "Jackson", whatsappNumber: "0700000000" }]);
});
test("agent receives the public form link at the assigned phone without an internal staff account", async () => {
  const preview = await technicianMessagePreview("receipt", "https://example.invalid");
  expect(preview.recipients[0].id).toBe("agent:jackson");
  await sendTechnicianCommissioningLink({ receiptId: "receipt", origin: "https://example.invalid", recipientId: "agent:jackson" });
  expect(sendCommissioningSms).toHaveBeenCalledWith(expect.objectContaining({ phone: "0700000000", recipientName: "Jackson", automaticKey: "technician:session:hash:agent:jackson", message: expect.stringContaining("https://example.invalid/commissioning/public-agent-token") }));
});
test("manual SMS refuses an agent not in the assignment", async () => {
  await expect(sendTechnicianCommissioningLink({ receiptId: "receipt", origin: "https://example.invalid", recipientId: "agent:other" })).rejects.toThrow("Assign an active");
  expect(sendCommissioningSms).not.toHaveBeenCalled();
});
