jest.mock("server-only", () => ({}), { virtual: true });

import { siteVisitUpdateSchema } from "@/lib/siteVisits";

describe("site visit update schema", () => {
  it("accepts independent overview actions without requiring the full booking form", () => {
    expect(
      siteVisitUpdateSchema.safeParse({
        scheduledAt: "2026-09-14",
        estimatedDurationMinutes: 30,
      }).success,
    ).toBe(true);
    expect(
      siteVisitUpdateSchema.safeParse({
        assignedStaffId: "staff-123",
      }).success,
    ).toBe(true);
    expect(
      siteVisitUpdateSchema.safeParse({
        assignedTechnicianId: "external:technician-123",
      }).success,
    ).toBe(true);
  });

  it("continues to validate the fields an overview action changes", () => {
    expect(
      siteVisitUpdateSchema.safeParse({
        estimatedDurationMinutes: 1.5,
      }).success,
    ).toBe(false);
  });
});
