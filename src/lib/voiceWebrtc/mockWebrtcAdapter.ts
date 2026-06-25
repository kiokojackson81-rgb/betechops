import type {
  VoiceWebrtcAdapter,
  VoiceWebrtcAdapterEventMap,
  VoiceWebrtcCallSession,
  VoiceWebrtcEventName,
  VoiceWebrtcRegistration,
} from "@/lib/voiceWebrtc/types";

type ListenerMap = {
  [K in VoiceWebrtcEventName]: Set<(payload: VoiceWebrtcAdapterEventMap[K]) => void>;
};

function createListenerMap(): ListenerMap {
  return {
    ready: new Set(),
    notready: new Set(),
    incomingcall: new Set(),
    calling: new Set(),
    callaccepted: new Set(),
    hangup: new Set(),
    offline: new Set(),
    closed: new Set(),
    error: new Set(),
  };
}

export class MockWebrtcAdapter implements VoiceWebrtcAdapter {
  private listeners = createListenerMap();
  private registration: VoiceWebrtcRegistration | null = null;
  private currentCall: VoiceWebrtcCallSession | null = null;

  private emit<T extends VoiceWebrtcEventName>(event: T, payload: VoiceWebrtcAdapterEventMap[T]) {
    this.listeners[event].forEach((listener) => listener(payload));
  }

  async register(registration: VoiceWebrtcRegistration) {
    this.registration = registration;
    this.emit("ready", { registration });
  }

  async unregister() {
    this.registration = null;
    this.currentCall = null;
    this.emit("closed", { reason: "mock_unregistered" });
  }

  async call(target: string) {
    this.currentCall = {
      id: `mock-webrtc-${Date.now()}`,
      to: target,
      direction: "OUTBOUND",
    };
    this.emit("calling", { call: this.currentCall });
  }

  async answer() {
    if (!this.currentCall) return;
    this.emit("callaccepted", { call: this.currentCall });
  }

  async reject() {
    if (!this.currentCall) return;
    const current = this.currentCall;
    this.currentCall = null;
    this.emit("hangup", { call: current, cause: { code: "REJECTED", reason: "mock_rejected" } });
  }

  async hangup() {
    if (!this.currentCall) return;
    const current = this.currentCall;
    this.currentCall = null;
    this.emit("hangup", { call: current, cause: { code: "HANGUP", reason: "mock_hangup" } });
  }

  async mute() {}
  async unmute() {}
  async hold() {}
  async unhold() {}
  async sendDtmf() {}

  on<T extends VoiceWebrtcEventName>(event: T, listener: (payload: VoiceWebrtcAdapterEventMap[T]) => void) {
    const bucket = this.listeners[event] as Set<(payload: VoiceWebrtcAdapterEventMap[T]) => void>;
    bucket.add(listener);
    return () => {
      bucket.delete(listener);
    };
  }
}
