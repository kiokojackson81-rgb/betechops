jest.mock("server-only", () => ({}), { virtual: true });

import {
  buildStickyVoiceTargetOrder,
  hasAnsweredVoiceBridge,
  type VoiceRouteTarget,
} from "@/lib/voice";
import {
  decodeRoutePlan,
  encodeRoutePlan,
  type VoiceRoutePlan,
} from "@/lib/voiceIvr";

function target(
  label: VoiceRouteTarget["label"],
  phoneNumber: string,
  userId: string | null,
): VoiceRouteTarget {
  return {
    label,
    phoneNumber,
    userId,
    presenceStatus: "AVAILABLE",
    isAvailable: true,
    routingEnabled: true,
    allowAfterHoursCalls: false,
    lastSeenAt: new Date("2026-08-17T08:00:00.000Z"),
    webRtcIdentity: null,
    isWebrtcRegistered: false,
    dialValue: phoneNumber,
    dialValues: [phoneNumber],
    skipReasons: [],
  };
}

describe("voice sticky return routing", () => {
  test("preserves the target user on encoded route-plan hops", () => {
    const plan: VoiceRoutePlan = {
      hops: [
        {
          label: "OVERFLOW",
          dialValue: "+254722607174",
          targetUserId: "fallback-user",
        },
      ],
      primaryTargetUserId: "fallback-user",
      routeType: "WORKING_HOURS",
      routeReason: "assigned_owner",
      routedTo: "+254722607174",
    };

    expect(decodeRoutePlan(encodeRoutePlan(plan))).toEqual(plan);
  });

  test("only treats a route hop as answered when bridge evidence exists", () => {
    expect(
      hasAnsweredVoiceBridge(
        {
          status: "completed",
          direction: "INBOUND",
          bridgeDurationInSeconds: "42",
        },
        "answered",
      ),
    ).toBe(true);
    expect(
      hasAnsweredVoiceBridge(
        { status: "answered", direction: "INBOUND" },
        "answered",
      ),
    ).toBe(false);
    expect(
      hasAnsweredVoiceBridge(
        {
          status: "no_answer",
          direction: "INBOUND",
          dialDurationInSeconds: "30",
        },
        "no_answer",
      ),
    ).toBe(false);
  });

  test("tries the previous fallback first, then continues from round robin", () => {
    const brendah = target("BRENDAH", "+254711000001", "brendah");
    const jennifer = target("JENNIFER", "+254711000002", "jennifer");
    const admin = target("ADMIN", "+254705663175", "admin");
    const fallback = target("OVERFLOW", "+254722607174", "fallback");

    expect(
      buildStickyVoiceTargetOrder({
        stickyTarget: fallback,
        roundRobinTarget: jennifer,
        agentTargets: [brendah, jennifer],
        adminTarget: admin,
      }).map((item) => item.label),
    ).toEqual(["OVERFLOW", "JENNIFER", "BRENDAH", "ADMIN"]);
  });

  test("does not ring the same phone twice when fallback numbers overlap", () => {
    const brendah = target("BRENDAH", "+254711000001", "brendah");
    const jennifer = target("JENNIFER", "+254711000002", "jennifer");
    const fallback = target("OVERFLOW", "+254722607174", "fallback");
    const duplicateAdmin = target("ADMIN", "0722607174", "admin");

    expect(
      buildStickyVoiceTargetOrder({
        stickyTarget: fallback,
        roundRobinTarget: brendah,
        agentTargets: [brendah, jennifer],
        adminTarget: duplicateAdmin,
      }).map((item) => item.label),
    ).toEqual(["OVERFLOW", "BRENDAH", "JENNIFER"]);
  });
});
