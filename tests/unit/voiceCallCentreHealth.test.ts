jest.mock("server-only", () => ({}), { virtual: true });

import { runOrderedChatraceHealthDelivery } from "@/lib/voiceCallCentreAlertDelivery";
import {
  evaluateBusyTransition,
  evaluateInactivityTransition,
  getNairobiWorkingWindow,
  resetInactivityIncidentOnInbound,
} from "@/lib/voiceCallCentreHealthLogic";

function chatraceResult(ok: boolean, error?: string) {
  return {
    ok,
    contactId: "123",
    debug: {
      phone: "254700000000",
      accountId: "test",
      fields: [],
      tagsAdded: [],
      tagsRemoved: [],
      steps: {},
      error,
    },
  };
}

describe("call centre BUSY incidents", () => {
  test("1. BUSY then BUSY triggers an alert", () => {
    let state = evaluateBusyTransition({ consecutiveBusy: 0, busyIncidentActive: false }, "BUSY");
    expect(state.shouldAlert).toBe(false);
    state = evaluateBusyTransition(state, "BUSY");
    expect(state.shouldAlert).toBe(true);
  });

  test("2. BUSY then ANSWERED then BUSY does not alert", () => {
    let state = evaluateBusyTransition({ consecutiveBusy: 0, busyIncidentActive: false }, "BUSY");
    state = evaluateBusyTransition(state, "ANSWERED");
    state = evaluateBusyTransition(state, "BUSY");
    expect(state.shouldAlert).toBe(false);
    expect(state.consecutiveBusy).toBe(1);
  });

  test("3. active BUSY incident suppresses duplicate alerts", () => {
    const state = evaluateBusyTransition({ consecutiveBusy: 2, busyIncidentActive: true }, "BUSY");
    expect(state.shouldAlert).toBe(false);
    expect(state.busyIncidentActive).toBe(true);
  });

  test("4. ANSWERED resets the BUSY incident", () => {
    const state = evaluateBusyTransition({ consecutiveBusy: 4, busyIncidentActive: true }, "ANSWERED");
    expect(state).toMatchObject({
      consecutiveBusy: 0,
      busyIncidentActive: false,
      shouldResolve: true,
    });
  });
});

describe("call centre inactivity incidents", () => {
  const mondayStart = new Date("2026-08-24T06:00:00.000Z");

  test("5. 59 working minutes does not alert", () => {
    const now = new Date("2026-08-24T06:59:00.000Z");
    expect(
      evaluateInactivityTransition({
        incidentActive: false,
        now,
        window: getNairobiWorkingWindow(now),
        lastInboundAt: mondayStart,
      }).shouldAlert,
    ).toBe(false);
  });

  test("6. 60 working minutes triggers an alert", () => {
    const now = new Date("2026-08-24T07:00:00.000Z");
    expect(
      evaluateInactivityTransition({
        incidentActive: false,
        now,
        window: getNairobiWorkingWindow(now),
        lastInboundAt: mondayStart,
      }).shouldAlert,
    ).toBe(true);
  });

  test("7. active inactivity incident suppresses duplicates", () => {
    const now = new Date("2026-08-24T08:00:00.000Z");
    expect(
      evaluateInactivityTransition({
        incidentActive: true,
        now,
        window: getNairobiWorkingWindow(now),
        lastInboundAt: null,
      }).shouldAlert,
    ).toBe(false);
  });

  test("8. a new inbound call resets inactivity", () => {
    expect(resetInactivityIncidentOnInbound().incidentActive).toBe(false);
  });

  test("9. outside working hours does not alert", () => {
    const now = new Date("2026-08-24T05:30:00.000Z");
    expect(getNairobiWorkingWindow(now)).toBeNull();
    expect(
      evaluateInactivityTransition({ incidentActive: false, now, window: null, lastInboundAt: null }).shouldAlert,
    ).toBe(false);
  });

  test("10. Sunday does not alert", () => {
    const now = new Date("2026-08-23T08:00:00.000Z");
    expect(getNairobiWorkingWindow(now)).toBeNull();
  });

  test("11. a new working day starts its own window without overnight carry", () => {
    const now = new Date("2026-08-24T06:10:00.000Z");
    const window = getNairobiWorkingWindow(now);
    expect(window?.start.toISOString()).toBe("2026-08-24T06:00:00.000Z");
    expect(
      evaluateInactivityTransition({
        incidentActive: false,
        now,
        window,
        lastInboundAt: new Date("2026-08-22T11:00:00.000Z"),
      }).shouldAlert,
    ).toBe(false);
  });
});

describe("ordered Chatrace health delivery", () => {
  test("12. custom-field failure prevents tag application", async () => {
    const sync = jest.fn().mockResolvedValueOnce(chatraceResult(false, "field_sync_failed"));
    const result = await runOrderedChatraceHealthDelivery({
      phone: "+254700000000",
      firstName: "Admin",
      issue: "Issue",
      alertTime: "24 Aug 2026, 10:00",
      sync,
    });
    expect(result.tagAttempted).toBe(false);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  test("13. both fields are updated in order before the tag", async () => {
    const sync = jest.fn().mockResolvedValue(chatraceResult(true));
    const beforeTagAttempt = jest.fn().mockResolvedValue(undefined);
    const result = await runOrderedChatraceHealthDelivery({
      phone: "+254700000000",
      firstName: "Admin",
      issue: "Issue",
      alertTime: "24 Aug 2026, 10:00",
      sync,
      beforeTagAttempt,
    });
    expect(result.ok).toBe(true);
    expect(sync.mock.calls[0][0].fields).toEqual({ "Call Centre Alert Issue": "Issue" });
    expect(sync.mock.calls[1][0].fields).toEqual({ "Call Centre Alert Time": "24 Aug 2026, 10:00" });
    expect(sync.mock.calls[2][0].tagsToAdd).toEqual(["betech_call_centre_health_alert"]);
    expect(beforeTagAttempt).toHaveBeenCalledTimes(1);
  });
});
