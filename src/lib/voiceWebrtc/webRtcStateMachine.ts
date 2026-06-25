import type { SoftphoneAvailabilityState, SoftphoneState } from "@/lib/voiceSoftphone";
import type { VoiceWebrtcEventName } from "@/lib/voiceWebrtc/types";

export type VoiceWebrtcDerivedState = {
  softphoneState: SoftphoneState;
  availability: SoftphoneAvailabilityState;
};

const DEFAULT_STATE: VoiceWebrtcDerivedState = {
  softphoneState: "NOT_REGISTERED",
  availability: "OFFLINE",
};

export function deriveVoiceWebrtcState(
  previous: VoiceWebrtcDerivedState | null | undefined,
  event: VoiceWebrtcEventName,
): VoiceWebrtcDerivedState {
  const current = previous ?? DEFAULT_STATE;

  switch (event) {
    case "ready":
      return { softphoneState: "AVAILABLE", availability: "AVAILABLE" };
    case "notready":
      return { softphoneState: "ERROR", availability: "OFFLINE" };
    case "incomingcall":
      return { softphoneState: "RINGING_INBOUND", availability: "RINGING" };
    case "calling":
      return { softphoneState: "RINGING_OUTBOUND", availability: "BUSY" };
    case "callaccepted":
      return { softphoneState: "TALKING", availability: "TALKING" };
    case "hangup":
      return { softphoneState: "AVAILABLE", availability: "AVAILABLE" };
    case "offline":
      return { softphoneState: "DISCONNECTED", availability: "OFFLINE" };
    case "closed":
      return { softphoneState: "DISCONNECTED", availability: current.availability === "OFFLINE" ? "OFFLINE" : "AWAY" };
    case "error":
      return { softphoneState: "ERROR", availability: "OFFLINE" };
    default:
      return current;
  }
}
