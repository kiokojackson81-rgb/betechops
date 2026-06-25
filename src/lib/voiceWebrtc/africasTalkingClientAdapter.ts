import type {
  VoiceWebrtcAdapter,
  VoiceWebrtcAdapterEventMap,
  VoiceWebrtcCallSession,
  VoiceWebrtcEventName,
  VoiceWebrtcRegistration,
} from "@/lib/voiceWebrtc/types";

declare global {
  interface Window {
    Africastalking?: {
      Client: new (token: string, params?: Record<string, unknown>) => {
        on: (event: string, listener: (...args: unknown[]) => void, capture?: boolean) => void;
        call?: (target: string) => void;
        answer?: () => void;
        hangup?: () => void;
        muteAudio?: () => void;
        mute?: () => void;
        unmuteAudio?: () => void;
        unmute?: () => void;
        hold?: () => void;
        unhold?: () => void;
        dtmf?: (digit: string) => void;
      };
    };
  }
}

const AFRICASTALKING_WEBRTC_BUNDLE_URL =
  "https://unpkg.com/africastalking-client@1.0.7/build/africastalking.js";

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

function normalizeCallSession(raw: unknown, fallback: Partial<VoiceWebrtcCallSession> = {}): VoiceWebrtcCallSession {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    id: String(value.id || value.sessionId || value.callSessionId || `webrtc-${Date.now()}`),
    from: typeof value.from === "string" ? value.from : (fallback.from ?? null),
    to: typeof value.to === "string" ? value.to : (fallback.to ?? null),
    direction: (fallback.direction ?? "OUTBOUND"),
    raw,
  };
}

async function ensureBrowserBundle() {
  if (typeof window === "undefined") throw new Error("browser_only");
  if (window.Africastalking?.Client) return window.Africastalking;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-africastalking-webrtc="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("africastalking_bundle_failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = AFRICASTALKING_WEBRTC_BUNDLE_URL;
    script.async = true;
    script.dataset.africastalkingWebrtc = "1";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("africastalking_bundle_failed")), { once: true });
    document.head.appendChild(script);
  });

  if (!window.Africastalking?.Client) {
    throw new Error("africastalking_client_missing");
  }
  return window.Africastalking;
}

export class AfricasTalkingClientAdapter implements VoiceWebrtcAdapter {
  private listeners = createListenerMap();
  private client:
    | {
        on: (event: string, listener: (...args: unknown[]) => void, capture?: boolean) => void;
        call?: (target: string) => void;
        answer?: () => void;
        hangup?: () => void;
        muteAudio?: () => void;
        mute?: () => void;
        unmuteAudio?: () => void;
        unmute?: () => void;
        hold?: () => void;
        unhold?: () => void;
        dtmf?: (digit: string) => void;
      }
    | null = null;

  private registration: VoiceWebrtcRegistration | null = null;
  private currentCall: VoiceWebrtcCallSession | null = null;

  private emit<T extends VoiceWebrtcEventName>(event: T, payload: VoiceWebrtcAdapterEventMap[T]) {
    this.listeners[event].forEach((listener) => listener(payload));
  }

  private bindClientEvents() {
    if (!this.client) return;

    this.client.on("ready", () => {
      if (this.registration) this.emit("ready", { registration: this.registration });
    }, false);

    this.client.on("notready", (reason) => {
      this.emit("notready", { reason: typeof reason === "string" ? reason : null });
    }, false);

    this.client.on("incomingcall", (params) => {
      this.currentCall = normalizeCallSession(params, { direction: "INBOUND" });
      this.emit("incomingcall", { call: this.currentCall });
    }, false);

    this.client.on("calling", (params) => {
      this.currentCall = normalizeCallSession(params, { direction: "OUTBOUND" });
      this.emit("calling", { call: this.currentCall });
    }, false);

    this.client.on("callaccepted", (params) => {
      this.currentCall = normalizeCallSession(params, { direction: this.currentCall?.direction ?? "OUTBOUND" });
      this.emit("callaccepted", { call: this.currentCall });
    }, false);

    this.client.on("hangup", (cause) => {
      const call = this.currentCall;
      this.currentCall = null;
      this.emit("hangup", {
        call,
        cause: (cause && typeof cause === "object" ? cause : null) as { code?: string | number; reason?: string | null } | null,
      });
    }, false);

    this.client.on("offline", (reason) => {
      this.emit("offline", { reason: typeof reason === "string" ? reason : null });
    }, false);

    this.client.on("closed", (reason) => {
      this.emit("closed", { reason: typeof reason === "string" ? reason : null });
    }, false);
  }

  async register(registration: VoiceWebrtcRegistration) {
    const sdk = await ensureBrowserBundle();
    this.registration = registration;
    this.client = new sdk.Client(registration.token);
    this.bindClientEvents();
  }

  async unregister() {
    this.client = null;
    this.registration = null;
    this.currentCall = null;
    this.emit("closed", { reason: "manual_unregister" });
  }

  async call(target: string) {
    this.client?.call?.(target);
  }

  async answer() {
    this.client?.answer?.();
  }

  async reject() {
    this.client?.hangup?.();
  }

  async hangup() {
    this.client?.hangup?.();
  }

  async mute() {
    if (this.client?.muteAudio) return this.client.muteAudio();
    return this.client?.mute?.();
  }

  async unmute() {
    if (this.client?.unmuteAudio) return this.client.unmuteAudio();
    return this.client?.unmute?.();
  }

  async hold() {
    this.client?.hold?.();
  }

  async unhold() {
    this.client?.unhold?.();
  }

  async sendDtmf(digit: string) {
    this.client?.dtmf?.(digit);
  }

  on<T extends VoiceWebrtcEventName>(event: T, listener: (payload: VoiceWebrtcAdapterEventMap[T]) => void) {
    const bucket = this.listeners[event] as Set<(payload: VoiceWebrtcAdapterEventMap[T]) => void>;
    bucket.add(listener);
    return () => {
      bucket.delete(listener);
    };
  }
}
