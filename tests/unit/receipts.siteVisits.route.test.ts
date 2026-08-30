jest.mock("server-only", () => ({}), { virtual: true });

import { jest } from "@jest/globals";

const requireAttendant = jest.fn();
const createSiteVisit = jest.fn();
const listAdminSiteVisits = jest.fn();
const findOrCreateCustomerIdentityUser = jest.fn();
const notifySiteVisitCustomer = jest.fn();
const notifyAdminCriticalSms = jest.fn();
const userFindUnique = jest.fn();
const userFindFirst = jest.fn();

jest.mock("@/lib/auth", () => ({ requireAttendant }));
jest.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: userFindUnique, findFirst: userFindFirst } } }));
jest.mock("@/lib/customerIdentity", () => ({ findOrCreateCustomerIdentityUser }));
jest.mock("@/lib/siteVisitNotifications", () => ({ notifySiteVisitCustomer }));
jest.mock("@/lib/adminCriticalSms", () => ({ notifyAdminCriticalSms }));
jest.mock("@/lib/siteVisits", () => ({
  siteVisitCreateSchema: {
    safeParse: jest.fn((data: unknown) => ({ success: true, data })),
  },
  createSiteVisit,
  listAdminSiteVisits,
}));

import { GET, POST } from "../../src/app/api/receipts/site-visits/route";

const actor = {
  id: "staff-1",
  name: "Jennifer",
  email: "jennifer@betech.co.ke",
  role: "ATTENDANT",
  isActive: true,
};

function request(body?: Record<string, unknown>) {
  return {
    url: "http://localhost/api/receipts/site-visits",
    nextUrl: new URL("http://localhost/api/receipts/site-visits"),
    json: async () => body,
  } as any;
}

describe("receipts site visit API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAttendant.mockResolvedValue({
      ok: true,
      user: { id: actor.id, role: "ATTENDANT", attendantCategory: "DIRECT_SALES_OPS" },
      role: "ATTENDANT",
    });
    userFindUnique.mockResolvedValue(actor);
    userFindFirst.mockResolvedValue(actor);
    findOrCreateCustomerIdentityUser.mockResolvedValue({
      user: { id: "customer-1" },
      matchedBy: "phone",
      emailConflict: false,
      normalizedPhone: "+254722000111",
      normalizedEmail: "customer@example.com",
    });
    notifySiteVisitCustomer.mockResolvedValue([]);
    notifyAdminCriticalSms.mockResolvedValue({ sent: 1, failed: 0, skipped: 0 });
  });

  it("allows receipts staff to choose the owning staff member and leaves technician assignment for admin", async () => {
    createSiteVisit.mockImplementation(async (input: any) => ({
      id: "visit-1",
      visitRef: "SV-2026-000001",
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      assignedStaffId: input.assignedStaffId,
      assignedStaffName: "Jennifer",
      assignedTechnicianId: null,
      assignedTechnicianName: null,
      town: input.town,
      county: input.county,
      visitFee: input.visitFee,
      dataLoggerRequested: true,
      dataLoggerDays: 2,
      totalPayable: 12_000,
      paymentStatus: "PAID",
    }));

    const response = await POST(request({
      customerName: "Customer One",
      customerPhone: "0722 000 111",
      customerEmail: "customer@example.com",
      county: "Nairobi",
      town: "Nairobi CBD",
      location: "Moi Avenue",
      preferredDate: "2026-09-02",
      preferredTimeLabel: "MORNING",
      projectType: "SOLAR_HOME_SYSTEM",
      visitReason: "LOAD_ASSESSMENT",
      customerRequirements: "Assess the customer's full load",
      assignedStaffId: "staff-1",
      dataLoggerRequested: true,
      dataLoggerDays: 2,
      paymentStatus: "PAID",
      paymentMethod: "M-PESA",
      paymentReference: "TXN1234567",
    }));

    expect(response.status).toBe(201);
    expect(findOrCreateCustomerIdentityUser).toHaveBeenCalledWith(expect.objectContaining({
      customerPhone: "+254722000111",
      county: "Nairobi",
    }));
    expect(userFindFirst).toHaveBeenCalledWith({
      where: { id: "staff-1", isActive: true, role: { in: ["ADMIN", "SUPERVISOR", "ATTENDANT"] } },
      select: { id: true, name: true, email: true },
    });
    expect(createSiteVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedStaffId: "staff-1",
        assignedTechnicianId: undefined,
        visitFee: 2_000,
        dataLoggerDays: 2,
        paymentAmount: 12_000,
        source: "STAFF",
      }),
      expect.objectContaining({ id: "staff-1", customerUserId: "customer-1" }),
    );
    expect(notifyAdminCriticalSms).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "SITE_VISIT_REQUESTED",
      entityId: "visit-1",
    }));
  });

  it("rejects an unknown or inactive selected owner", async () => {
    userFindFirst.mockResolvedValueOnce(null);

    const response = await POST(request({
      customerName: "Customer One",
      customerPhone: "0722 000 111",
      county: "Nairobi",
      town: "Nairobi CBD",
      location: "Moi Avenue",
      preferredDate: "2026-09-02",
      assignedStaffId: "missing-owner",
      paymentStatus: "UNPAID",
    }));

    expect(response.status).toBe(400);
    expect(createSiteVisit).not.toHaveBeenCalled();
  });

  it("prevents ordinary staff from waiving payment", async () => {
    const response = await POST(request({
      customerName: "Customer One",
      customerPhone: "0722000111",
      county: "Nairobi",
      town: "Nairobi CBD",
      location: "Moi Avenue",
      preferredDate: "2026-09-02",
      paymentStatus: "WAIVED",
    }));

    expect(response.status).toBe(403);
    expect(createSiteVisit).not.toHaveBeenCalled();
  });

  it("returns only visits assigned to the current staff owner", async () => {
    listAdminSiteVisits.mockResolvedValue([{ id: "visit-1" }]);
    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listAdminSiteVisits).toHaveBeenCalledWith({ assignedUserId: "staff-1" });
    expect(payload.actor.name).toBe("Jennifer");
    expect(payload.visits).toEqual([{ id: "visit-1" }]);
  });
});
