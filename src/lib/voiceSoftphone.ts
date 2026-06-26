export const SOFTPHONE_STATES = [
  "NOT_REGISTERED",
  "REGISTERING",
  "REGISTERED",
  "AVAILABLE",
  "RINGING_INBOUND",
  "RINGING_OUTBOUND",
  "TALKING",
  "ON_HOLD",
  "BUSY",
  "DISCONNECTED",
  "ERROR",
] as const;

export type SoftphoneState = (typeof SOFTPHONE_STATES)[number];

export type SoftphoneDirection = "INBOUND" | "OUTBOUND";

export type SoftphoneDevice = {
  id: string;
  label: string;
  kind: "audioinput" | "audiooutput";
};

export const SOFTPHONE_AVAILABILITY_STATES = [
  "AVAILABLE",
  "AWAY",
  "BUSY",
  "BREAK",
  "OFFLINE",
  "RINGING",
  "TALKING",
] as const;

export type SoftphoneAvailabilityState = (typeof SOFTPHONE_AVAILABILITY_STATES)[number];

export type SoftphonePreferences = {
  microphoneId: string;
  speakerId: string;
  ringVolume: number;
  outputVolume: number;
  autoAnswer: boolean;
  autoRegister: boolean;
  noiseSuppression: boolean;
  echoCancellation: boolean;
};

export type SoftphoneSipConfig = {
  username: string;
  password: string;
  domain: string;
  wssServer: string;
};

export type SoftphoneCustomerSummary = {
  name: string;
  phone: string;
  location: string;
  totalSpent: number;
  recentOrders: number;
  recentQuotes: number;
  recentReceipts: number;
  notes: string[];
};

export type SoftphoneCall = {
  id: string;
  direction: SoftphoneDirection;
  displayName: string;
  remoteIdentity: string;
  startedAt: string | null;
  state: SoftphoneState;
  muted: boolean;
  held: boolean;
  dtmfHistory: string[];
  customer: SoftphoneCustomerSummary | null;
};

export type SoftphoneMockEvent =
  | "incoming"
  | "outgoing"
  | "answered"
  | "rejected"
  | "ended"
  | "hold"
  | "resume"
  | "disconnect"
  | "reconnect"
  | "transfer";

export const DEFAULT_SOFTPHONE_PREFERENCES: SoftphonePreferences = {
  microphoneId: "",
  speakerId: "",
  ringVolume: 70,
  outputVolume: 80,
  autoAnswer: false,
  autoRegister: true,
  noiseSuppression: true,
  echoCancellation: true,
};

export const SOFTPHONE_STORAGE_KEY = "betechops:voice-softphone-preferences";
export const SOFTPHONE_COLLAPSED_STORAGE_KEY = "betechops:softphone-collapsed";
export const SOFTPHONE_SIP_CONFIG_STORAGE_KEY = "betechops:voice-softphone-sip-config";
export const SOFTPHONE_MOCK_HISTORY_STORAGE_KEY = "betechops:voice-softphone-history";

export const DEFAULT_SOFTPHONE_SIP_CONFIG: SoftphoneSipConfig = {
  username: "",
  password: "",
  domain: "ke.sip.africastalking.com",
  wssServer: "",
};

export function getSoftphoneStateLabel(state: SoftphoneState) {
  return state.replace(/_/g, " ");
}

export function getAvailabilityLabel(state: SoftphoneAvailabilityState) {
  return state === "AVAILABLE" ? "Available" : "Offline";
}

export function normalizeSoftphoneVolume(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function buildDefaultMockCustomer(phone = "+254700000001"): SoftphoneCustomerSummary {
  return {
    name: "Mock Customer",
    phone,
    location: "Nakuru",
    totalSpent: 245000,
    recentOrders: 2,
    recentQuotes: 1,
    recentReceipts: 3,
    notes: ["Interested in solar backup", "Requested callback this week"],
  };
}

export function buildMockCall(input: {
  direction: SoftphoneDirection;
  state: SoftphoneState;
  phone: string;
  displayName: string;
  customer?: SoftphoneCustomerSummary | null;
}): SoftphoneCall {
  return {
    id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    direction: input.direction,
    displayName: input.displayName,
    remoteIdentity: input.phone,
    startedAt: input.state === "TALKING" || input.state === "ON_HOLD" ? new Date().toISOString() : null,
    state: input.state,
    muted: false,
    held: false,
    dtmfHistory: [],
    customer: input.customer ?? buildDefaultMockCustomer(input.phone),
  };
}
