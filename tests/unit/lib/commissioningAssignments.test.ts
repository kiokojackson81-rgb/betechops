jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/commissioningSms", () => ({}));
import { Prisma } from "@prisma/client";
import { syncCommissioningAssignment } from "@/lib/commissioningAssignments";

const tx = { commissioningSession: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() }, user: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) } };
beforeEach(() => { jest.clearAllMocks(); process.env.COMMISSIONING_LINK_ENCRYPTION_SECRET = "test-key-only"; });

test("saving the same assignment preserves its link", async () => {
  const existing = { id: "s", technicianId: "samuel", status: "DRAFT", tokenHash: "unchanged" };
  tx.commissioningSession.findUnique.mockResolvedValue(existing);
  expect(await syncCommissioningAssignment(tx as unknown as Prisma.TransactionClient, "r", "samuel")).toBe(existing);
  expect(tx.commissioningSession.update).not.toHaveBeenCalled();
});

test("reassignment replaces the token and removes the old installer's signature", async () => {
  tx.commissioningSession.findUnique.mockResolvedValue({ id: "s", technicianId: "old", status: "AWAITING_PROFESSIONAL_REVIEW", data: { evidence: { panelArray: ["saved"] }, signatures: { technician: "old-signature", customer: "customer-signature" } } });
  await syncCommissioningAssignment(tx as unknown as Prisma.TransactionClient, "r", "new");
  const updated = tx.commissioningSession.update.mock.calls[0][0].data;
  expect(updated.technicianId).toBe("new"); expect(updated.status).toBe("DRAFT");
  expect(updated.tokenHash).toBeTruthy(); expect(updated.data.signatures.technician).toBe("");
  expect(updated.data.evidence.panelArray).toEqual(["saved"]);
});

test("removing an installer revokes pending-review access", async () => {
  tx.commissioningSession.findUnique.mockResolvedValue({ id: "s", technicianId: "old", status: "AWAITING_PROFESSIONAL_REVIEW" });
  await syncCommissioningAssignment(tx as unknown as Prisma.TransactionClient, "r", null);
  expect(tx.commissioningSession.update.mock.calls[0][0].data.status).toBe("REVOKED");
});
