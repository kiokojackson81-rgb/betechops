export const VOICE_WEBRTC_EVENTS = [
  "ready",
  "notready",
  "incomingcall",
  "calling",
  "callaccepted",
  "hangup",
  "offline",
  "closed",
  "error",
] as const;

export type VoiceWebrtcEventName = (typeof VOICE_WEBRTC_EVENTS)[number];

export type VoiceWebrtcTokenResponse = {
  token: string;
  clientName: string;
  identity: string;
  expiresAt: string;
  phoneNumber: string;
  mode: "mock" | "webrtc";
};

export type VoiceWebrtcRegistration = {
  token: string;
  clientName: string;
  identity: string;
  phoneNumber: string;
  username: string;
  expiresAt: string;
};

export type VoiceWebrtcCallSession = {
  id: string;
  from?: string | null;
  to?: string | null;
  direction?: "INBOUND" | "OUTBOUND";
  raw?: unknown;
};

export type VoiceWebrtcAdapterEventMap = {
  ready: { registration: VoiceWebrtcRegistration };
  notready: { reason?: string | null };
  incomingcall: { call: VoiceWebrtcCallSession };
  calling: { call: VoiceWebrtcCallSession };
  callaccepted: { call: VoiceWebrtcCallSession };
  hangup: { call?: VoiceWebrtcCallSession | null; cause?: { code?: string | number; reason?: string | null } | null };
  offline: { reason?: string | null };
  closed: { reason?: string | null };
  error: { error: string };
};

export type VoiceWebrtcAdapterListener<T extends VoiceWebrtcEventName> = (
  payload: VoiceWebrtcAdapterEventMap[T],
) => void;

export interface VoiceWebrtcAdapter {
  register(registration: VoiceWebrtcRegistration): Promise<void>;
  unregister(): Promise<void>;
  call(target: string): Promise<void>;
  answer(): Promise<void>;
  reject(): Promise<void>;
  hangup(): Promise<void>;
  mute(): Promise<void>;
  unmute(): Promise<void>;
  hold(): Promise<void>;
  unhold(): Promise<void>;
  sendDtmf(digit: string): Promise<void>;
  on<T extends VoiceWebrtcEventName>(event: T, listener: VoiceWebrtcAdapterListener<T>): () => void;
}
