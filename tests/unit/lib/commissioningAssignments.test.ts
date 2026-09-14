jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/commissioningSms", () => ({}));
import { Prisma } from "@prisma/client";
import { syncCommissioningAssignment } from "@/lib/commissioningAssignments";

const tx = { projectExternalAgent: { findUnique: jest.fn().mockResolvedValue({ isActive: true, name: "Agent Jackson" }) }, commissioningSession: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() }, user: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) } };
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
  expect(updated.data.installerName).toBe("");
  expect(updated.technicianId).toBe("new"); expect(updated.status).toBe("DRAFT");
  expect(updated.tokenHash).toBeTruthy(); expect(updated.data.signatures.technician).toBe("");
  expect(updated.data.evidence.panelArray).toEqual(["saved"]);
});

test("removing an installer revokes pending-review access", async () => {
  tx.commissioningSession.findUnique.mockResolvedValue({ id: "s", technicianId: "old", status: "AWAITING_PROFESSIONAL_REVIEW" });
  await syncCommissioningAssignment(tx as unknown as Prisma.TransactionClient, "r", null);
  expect(tx.commissioningSession.update.mock.calls[0][0].data.status).toBe("REVOKED");
});

test("an external agent can receive a public commissioning assignment without staff", async () => {
  tx.commissioningSession.findUnique.mockResolvedValue(null);
  await syncCommissioningAssignment(tx as unknown as Prisma.TransactionClient, "r", null, "admin", { staffIds: [], externalAgentIds: ["jackson"] });
  const created = tx.commissioningSession.create.mock.calls[0][0].data;
  expect(created.technicianId).toBeNull();
  expect(created.assignment).toEqual({ staffIds: [], externalAgentIds: ["jackson"], names: ["Agent Jackson"] });
  expect(created.tokenCiphertext).toBeTruthy();
});

test("changing the assigned agent rotates access and removes the prior signature", async () => {
  tx.commissioningSession.findUnique.mockResolvedValue({ id: "s", status: "DRAFT", technicianId: null, assignment: { staffIds: [], externalAgentIds: ["old"] }, data: { signatures: { technician: "old" } } });
  await syncCommissioningAssignment(tx as unknown as Prisma.TransactionClient, "r", null, "admin", { staffIds: [], externalAgentIds: ["jackson"] });
  expect(tx.commissioningSession.update.mock.calls[0][0].data.data.signatures.technician).toBe("");
  expect(tx.commissioningSession.update.mock.calls[0][0].data.assignment.externalAgentIds).toEqual(["jackson"]);
});

test("saving the same agent preserves the existing form and link", async () => {
  const existing = { id: "s", status: "DRAFT", technicianId: null, assignment: { staffIds: [], externalAgentIds: ["jackson"] } };
  tx.commissioningSession.findUnique.mockResolvedValue(existing);
  expect(await syncCommissioningAssignment(tx as unknown as Prisma.TransactionClient, "r", null, "admin", { staffIds: [], externalAgentIds: ["jackson"] })).toBe(existing);
  expect(tx.commissioningSession.update).not.toHaveBeenCalled();
});
