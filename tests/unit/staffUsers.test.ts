import { buildStaffAttendantWhere, isStaffAttendantLike } from "@/lib/staffUsers";

describe("isStaffAttendantLike", () => {
  it("accepts real attendants with a category", () => {
    expect(
      isStaffAttendantLike({
        role: "ATTENDANT",
        attendantCategory: "MARKETING_OPS",
        categories: [],
        hasAgentProfile: false,
      }),
    ).toBe(true);
  });

  it("accepts supervisors with category assignments", () => {
    expect(
      isStaffAttendantLike({
        role: "SUPERVISOR",
        attendantCategory: null,
        categories: ["DIRECT_SALES_OPS"],
        hasAgentProfile: false,
      }),
    ).toBe(true);
  });

  it("rejects users without attendant markers", () => {
    expect(
      isStaffAttendantLike({
        role: "ATTENDANT",
        attendantCategory: null,
        categories: [],
        hasAgentProfile: false,
      }),
    ).toBe(false);
  });

  it("rejects agent-only users", () => {
    expect(
      isStaffAttendantLike({
        role: "ATTENDANT",
        attendantCategory: "MARKETING_OPS",
        categories: ["MARKETING_OPS"],
        hasAgentProfile: true,
      }),
    ).toBe(false);
  });
});

describe("buildStaffAttendantWhere", () => {
  it("requires staff roles, no agent profile, and a staff category marker", () => {
    expect(buildStaffAttendantWhere()).toEqual({
      role: { in: ["ATTENDANT", "SUPERVISOR"] },
      agentProfile: { is: null },
      OR: [
        { attendantCategory: { not: null } },
        { categoryAssignments: { some: {} } },
      ],
    });
  });
});
