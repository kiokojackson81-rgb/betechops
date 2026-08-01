import {
  hasProjectAssignedHandler,
  hasProjectBookingDate,
  shouldSendProjectAssigned,
  shouldSendProjectBooked,
} from "@/services/project-notifications/project-notification.logic";

describe("project notification logic", () => {
  test("first booking triggers when scheduled date exists even without handler", () => {
    expect(
      shouldSendProjectBooked({
        previousProjectFlow: null,
        nextProjectFlow: { scheduledDate: "2026-08-02" },
        hasSuccessfulBookedLog: false,
      }),
    ).toBe(true);
  });

  test("existing booking without sent log can still trigger booked notification", () => {
    expect(
      shouldSendProjectBooked({
        previousProjectFlow: { scheduledDate: "2026-08-02" },
        nextProjectFlow: { scheduledDate: "2026-08-02" },
        hasSuccessfulBookedLog: false,
      }),
    ).toBe(true);
  });

  test("booking does not trigger without scheduled date", () => {
    expect(
      shouldSendProjectBooked({
        previousProjectFlow: null,
        nextProjectFlow: { scheduledDate: null },
        hasSuccessfulBookedLog: false,
      }),
    ).toBe(false);
  });

  test("assignment triggers when handler is added", () => {
    expect(
      shouldSendProjectAssigned({
        previousProjectFlow: { scheduledDate: "2026-08-02" },
        nextProjectFlow: { scheduledDate: "2026-08-02", handlerStaffId: "u1" },
        changedFields: ["handlerStaffId"],
      }),
    ).toBe(true);
  });

  test("helper detects booking and assignment states", () => {
    expect(hasProjectBookingDate({ scheduledDate: "2026-08-02" })).toBe(true);
    expect(hasProjectAssignedHandler({ handlerStaffName: "Tech One" })).toBe(true);
    expect(hasProjectAssignedHandler({})).toBe(false);
  });
});
