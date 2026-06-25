"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  buildDefaultMockCustomer,
  buildMockCall,
  DEFAULT_SOFTPHONE_SIP_CONFIG,
  DEFAULT_SOFTPHONE_PREFERENCES,
  getAvailabilityLabel,
  getSoftphoneStateLabel,
  normalizeSoftphoneVolume,
  SOFTPHONE_COLLAPSED_STORAGE_KEY,
  SOFTPHONE_MOCK_HISTORY_STORAGE_KEY,
  SOFTPHONE_SIP_CONFIG_STORAGE_KEY,
  SOFTPHONE_STORAGE_KEY,
  type SoftphoneAvailabilityState,
  type SoftphoneCall,
  type SoftphoneCustomerSummary,
  type SoftphoneDevice,
  type SoftphoneMockEvent,
  type SoftphonePreferences,
  type SoftphoneSipConfig,
  type SoftphoneState,
} from "@/lib/voiceSoftphone";
import { AfricasTalkingClientAdapter } from "@/lib/voiceWebrtc/africasTalkingClientAdapter";
import { MockWebrtcAdapter } from "@/lib/voiceWebrtc/mockWebrtcAdapter";
import type {
  VoiceWebrtcAdapter,
  VoiceWebrtcCallSession,
  VoiceWebrtcRegistration,
  VoiceWebrtcTokenResponse,
} from "@/lib/voiceWebrtc/types";
import { deriveVoiceWebrtcState } from "@/lib/voiceWebrtc/webRtcStateMachine";

type SoftphoneContextValue = {
  state: SoftphoneState;
  stateLabel: string;
  availability: SoftphoneAvailabilityState;
  availabilityLabel: string;
  transportMode: "mock" | "webrtc" | "unavailable";
  statusMessage: string | null;
  connectionStatus: "idle" | "ready" | "warning" | "error";
  registrationStatus: "unregistered" | "registering" | "registered" | "disconnected" | "error";
  isRegistered: boolean;
  isCollapsed: boolean;
  currentCall: SoftphoneCall | null;
  incomingCall: SoftphoneCall | null;
  recentCalls: SoftphoneCall[];
  favoriteNumbers: Array<{ label: string; phone: string }>;
  devices: {
    microphones: SoftphoneDevice[];
    speakers: SoftphoneDevice[];
  };
  preferences: SoftphonePreferences;
  sipConfig: SoftphoneSipConfig;
  microphonePermission: PermissionState | "unsupported" | "prompt";
  remoteAudioRef: React.MutableRefObject<HTMLAudioElement | null>;
  dialedDigits: string;
  microphoneLevel: number;
  outputLevel: number;
  selectedCustomer: SoftphoneCustomerSummary | null;
  hasSpeakerSelection: boolean;
  lastHeartbeatAt: string | null;
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  requestMicrophoneAccess: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  updatePreferences: (next: Partial<SoftphonePreferences>) => void;
  updateSipConfig: (next: Partial<SoftphoneSipConfig>) => void;
  setCollapsed: (next: boolean) => void;
  setAvailability: (next: SoftphoneAvailabilityState) => void;
  appendDigit: (digit: string) => void;
  backspaceDigit: () => void;
  clearDialPad: () => void;
  startOutgoingCall: (target?: string) => void;
  answerCall: () => void;
  rejectCall: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  toggleHold: () => void;
  sendDtmf: (digit: string) => void;
  runSpeakerTest: () => Promise<void>;
  runMicrophoneTest: () => Promise<void>;
  triggerMockEvent: (event: SoftphoneMockEvent) => void;
  seedCustomerContext: (customer: SoftphoneCustomerSummary | null) => void;
};

const SoftphoneContext = createContext<SoftphoneContextValue | null>(null);
const NEXT_PUBLIC_VOICE_WEBRTC_ENABLED =
  String(process.env.NEXT_PUBLIC_VOICE_WEBRTC_ENABLED || "").trim().toLowerCase() === "true";

function readStoredPreferences() {
  if (typeof window === "undefined") return DEFAULT_SOFTPHONE_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(SOFTPHONE_STORAGE_KEY);
    if (!raw) return DEFAULT_SOFTPHONE_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<SoftphonePreferences>;
    return {
      ...DEFAULT_SOFTPHONE_PREFERENCES,
      ...parsed,
      ringVolume: normalizeSoftphoneVolume(Number(parsed.ringVolume ?? DEFAULT_SOFTPHONE_PREFERENCES.ringVolume)),
      outputVolume: normalizeSoftphoneVolume(Number(parsed.outputVolume ?? DEFAULT_SOFTPHONE_PREFERENCES.outputVolume)),
    };
  } catch {
    return DEFAULT_SOFTPHONE_PREFERENCES;
  }
}

function readStoredSipConfig() {
  if (typeof window === "undefined") return DEFAULT_SOFTPHONE_SIP_CONFIG;
  try {
    const raw = window.localStorage.getItem(SOFTPHONE_SIP_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_SOFTPHONE_SIP_CONFIG;
    const parsed = JSON.parse(raw) as Partial<SoftphoneSipConfig>;
    return {
      ...DEFAULT_SOFTPHONE_SIP_CONFIG,
      ...parsed,
    };
  } catch {
    return DEFAULT_SOFTPHONE_SIP_CONFIG;
  }
}

function readStoredRecentCalls() {
  if (typeof window === "undefined") return [] as SoftphoneCall[];
  try {
    const raw = window.localStorage.getItem(SOFTPHONE_MOCK_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SoftphoneCall[];
  } catch {
    return [];
  }
}

function mapAvailabilityToPresenceStatus(state: SoftphoneAvailabilityState) {
  if (state === "AVAILABLE") return "AVAILABLE";
  if (state === "BUSY" || state === "RINGING" || state === "TALKING") return "BUSY";
  if (state === "BREAK" || state === "AWAY") return "BREAK";
  return "OFFLINE";
}

function makeFavoriteNumbers(sessionName: string | null | undefined) {
  return [
    { label: "Brendah", phone: "+254716722601" },
    { label: "Jennifer", phone: "+254703241917" },
    { label: sessionName || "Admin", phone: "+254705663175" },
  ];
}

function mapSoftphoneStateToWebrtcRegistryState(state: SoftphoneState) {
  if (["AVAILABLE", "REGISTERED", "RINGING_INBOUND", "RINGING_OUTBOUND", "TALKING", "ON_HOLD", "BUSY"].includes(state)) {
    return "ready" as const;
  }
  if (state === "ERROR") return "error" as const;
  if (state === "DISCONNECTED") return "offline" as const;
  return "notready" as const;
}

export function SoftphoneProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [state, setState] = useState<SoftphoneState>("NOT_REGISTERED");
  const [availability, setAvailabilityState] = useState<SoftphoneAvailabilityState>("OFFLINE");
  const [currentCall, setCurrentCall] = useState<SoftphoneCall | null>(null);
  const [recentCalls, setRecentCalls] = useState<SoftphoneCall[]>([]);
  const [preferences, setPreferences] = useState<SoftphonePreferences>(DEFAULT_SOFTPHONE_PREFERENCES);
  const [sipConfig, setSipConfig] = useState<SoftphoneSipConfig>(DEFAULT_SOFTPHONE_SIP_CONFIG);
  const [microphonePermission, setMicrophonePermission] = useState<PermissionState | "unsupported" | "prompt">("prompt");
  const [microphones, setMicrophones] = useState<SoftphoneDevice[]>([]);
  const [speakers, setSpeakers] = useState<SoftphoneDevice[]>([]);
  const [dialedDigits, setDialedDigits] = useState("");
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<SoftphoneCustomerSummary | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const activityTimerRef = useRef<number | null>(null);
  const microphoneTestTimeoutRef = useRef<number | null>(null);
  const speakerTestTimeoutRef = useRef<number | null>(null);
  const stateRef = useRef<SoftphoneState>("NOT_REGISTERED");
  const availabilityRef = useRef<SoftphoneAvailabilityState>("OFFLINE");
  const currentCallRef = useRef<SoftphoneCall | null>(null);
  const selectedCustomerRef = useRef<SoftphoneCustomerSummary | null>(null);
  const adapterRef = useRef<VoiceWebrtcAdapter | null>(null);
  const webRtcRegistrationRef = useRef<VoiceWebrtcRegistration | null>(null);
  const webRtcModeRef = useRef<"mock" | "webrtc" | "unavailable">("mock");
  const adapterCleanupRef = useRef<(() => void) | null>(null);
  const [transportMode, setTransportMode] = useState<"mock" | "webrtc" | "unavailable">("mock");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    availabilityRef.current = availability;
  }, [availability]);

  useEffect(() => {
    currentCallRef.current = currentCall;
  }, [currentCall]);

  useEffect(() => {
    selectedCustomerRef.current = selectedCustomer;
  }, [selectedCustomer]);

  useEffect(() => {
    setPreferences(readStoredPreferences());
    setSipConfig(readStoredSipConfig());
    setRecentCalls(readStoredRecentCalls());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SOFTPHONE_STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SOFTPHONE_SIP_CONFIG_STORAGE_KEY, JSON.stringify(sipConfig));
  }, [sipConfig]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SOFTPHONE_MOCK_HISTORY_STORAGE_KEY, JSON.stringify(recentCalls));
  }, [recentCalls]);

  const refreshDevices = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    const nextMicrophones = list
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        id: device.deviceId,
        label: device.label || `Microphone ${index + 1}`,
        kind: "audioinput" as const,
      }));
    const nextSpeakers = list
      .filter((device) => device.kind === "audiooutput")
      .map((device, index) => ({
        id: device.deviceId,
        label: device.label || `Speaker ${index + 1}`,
        kind: "audiooutput" as const,
      }));
    setMicrophones(nextMicrophones);
    setSpeakers(nextSpeakers);
  };

  const syncPermission = async () => {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) return;
    try {
      const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
      setMicrophonePermission(status.state);
      status.onchange = () => setMicrophonePermission(status.state);
    } catch {
      setMicrophonePermission("unsupported");
    }
  };

  useEffect(() => {
    void syncPermission();
    void refreshDevices();
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.addEventListener) return;
    const handler = () => {
      void refreshDevices();
    };
    navigator.mediaDevices.addEventListener("devicechange", handler);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handler);
    };
  }, []);

  const stopMeter = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setMicrophoneLevel(0);
  };

  const requestMicrophoneAccess = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: preferences.microphoneId || undefined,
        echoCancellation: preferences.echoCancellation,
        noiseSuppression: preferences.noiseSuppression,
      },
    });

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = stream;
    setMicrophonePermission("granted");
    await refreshDevices();
  };

  const beginMeter = () => {
    if (!localStreamRef.current) return;
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    const source = context.createMediaStreamSource(localStreamRef.current);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, value) => sum + value, 0) / Math.max(1, data.length);
      setMicrophoneLevel(Math.round((avg / 255) * 100));
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const runMicrophoneTest = async () => {
    await requestMicrophoneAccess();
    stopMeter();
    beginMeter();
    if (microphoneTestTimeoutRef.current) window.clearTimeout(microphoneTestTimeoutRef.current);
    microphoneTestTimeoutRef.current = window.setTimeout(() => {
      stopMeter();
      microphoneTestTimeoutRef.current = null;
    }, 3000);
  };

  const runSpeakerTest = async () => {
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 440;
    gain.gain.value = Math.max(0.01, preferences.outputVolume / 100);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    setOutputLevel(preferences.outputVolume);
    if (speakerTestTimeoutRef.current) window.clearTimeout(speakerTestTimeoutRef.current);
    speakerTestTimeoutRef.current = window.setTimeout(() => {
      oscillator.stop();
      setOutputLevel(0);
      speakerTestTimeoutRef.current = null;
    }, 1200);
  };

  const pushRecentCall = (call: SoftphoneCall) => {
    setRecentCalls((current) => [call, ...current].slice(0, 24));
  };

  const applyWebrtcDerivedState = (
    event: "ready" | "notready" | "incomingcall" | "calling" | "callaccepted" | "hangup" | "offline" | "closed" | "error",
  ) => {
    const next = deriveVoiceWebrtcState(
      {
        softphoneState: stateRef.current,
        availability: availabilityRef.current,
      },
      event,
    );
    setAvailabilityState(next.availability);
    setState(next.softphoneState);
  };

  const buildCallFromWebrtcSession = (
    session: VoiceWebrtcCallSession,
    nextState: SoftphoneState,
  ): SoftphoneCall => {
    const remoteIdentity =
      session.direction === "INBOUND"
        ? String(session.from || "")
        : String(session.to || session.from || "");
    const customer =
      selectedCustomerRef.current && selectedCustomerRef.current.phone === remoteIdentity
        ? selectedCustomerRef.current
        : buildDefaultMockCustomer(remoteIdentity || undefined);
    return {
      id: session.id,
      direction: session.direction ?? "OUTBOUND",
      displayName: customer.name || remoteIdentity || "Voice caller",
      remoteIdentity: remoteIdentity || customer.phone,
      startedAt:
        nextState === "TALKING" || nextState === "ON_HOLD" ? new Date().toISOString() : null,
      state: nextState,
      muted: false,
      held: false,
      dtmfHistory: [],
      customer,
    };
  };

  const attachAdapterListeners = (adapter: VoiceWebrtcAdapter) => {
    const unsubs = [
      adapter.on("ready", ({ registration }) => {
        webRtcRegistrationRef.current = registration;
        webRtcModeRef.current = "webrtc";
        setTransportMode("webrtc");
        setStatusMessage(null);
        applyWebrtcDerivedState("ready");
      }),
      adapter.on("notready", () => {
        setStatusMessage("Africa's Talking WebRTC client is not ready.");
        applyWebrtcDerivedState("notready");
      }),
      adapter.on("incomingcall", ({ call }) => {
        setCurrentCall(buildCallFromWebrtcSession({ ...call, direction: "INBOUND" }, "RINGING_INBOUND"));
        applyWebrtcDerivedState("incomingcall");
      }),
      adapter.on("calling", ({ call }) => {
        setCurrentCall(buildCallFromWebrtcSession({ ...call, direction: "OUTBOUND" }, "RINGING_OUTBOUND"));
        applyWebrtcDerivedState("calling");
      }),
      adapter.on("callaccepted", ({ call }) => {
        setCurrentCall((existing) => {
          const nextCall = existing ?? buildCallFromWebrtcSession(call, "TALKING");
          return {
            ...nextCall,
            startedAt: nextCall.startedAt || new Date().toISOString(),
            state: "TALKING",
          };
        });
        applyWebrtcDerivedState("callaccepted");
      }),
      adapter.on("hangup", () => {
        setCurrentCall((existing) => {
          if (!existing) return null;
          pushRecentCall({ ...existing, state: "DISCONNECTED" });
          return null;
        });
        applyWebrtcDerivedState("hangup");
      }),
      adapter.on("offline", () => {
        setStatusMessage("Africa's Talking WebRTC client went offline.");
        applyWebrtcDerivedState("offline");
      }),
      adapter.on("closed", () => {
        setCurrentCall((existing) => {
          if (!existing) return null;
          pushRecentCall({ ...existing, state: "DISCONNECTED" });
          return null;
        });
        setStatusMessage("Africa's Talking WebRTC client session closed.");
        applyWebrtcDerivedState("closed");
      }),
      adapter.on("error", ({ error }) => {
        setStatusMessage(error || "Africa's Talking WebRTC client failed.");
        setState("ERROR");
        setAvailabilityState("OFFLINE");
      }),
    ];

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  };

  const setAvailability = (next: SoftphoneAvailabilityState) => {
    setAvailabilityState(next);
  };

  const registerMockAdapter = async (options?: { statusMessage?: string | null }) => {
    const adapter = new MockWebrtcAdapter();
    adapterRef.current = adapter;
    adapterCleanupRef.current?.();
    adapterCleanupRef.current = attachAdapterListeners(adapter);
    const registration: VoiceWebrtcRegistration = {
      token: "mock-token",
      clientName: "mock",
      identity: "mock.client",
      phoneNumber: "",
      username: "mock",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
    await adapter.register(registration);
    webRtcRegistrationRef.current = registration;
    webRtcModeRef.current = "mock";
    setTransportMode("mock");
    setStatusMessage(options?.statusMessage ?? null);
  };

  const setWebrtcUnavailable = (message: string) => {
    adapterCleanupRef.current?.();
    adapterCleanupRef.current = null;
    adapterRef.current = null;
    webRtcRegistrationRef.current = null;
    webRtcModeRef.current = "unavailable";
    setTransportMode("unavailable");
    setStatusMessage(message);
    setCurrentCall(null);
    setAvailability("OFFLINE");
    setState("ERROR");
  };

  const register = async () => {
    setState("REGISTERING");
    setStatusMessage(null);

    if (!NEXT_PUBLIC_VOICE_WEBRTC_ENABLED) {
      await registerMockAdapter();
      return;
    }

    try {
      const response = await fetch("/api/voice/webrtc/token", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as
        | (VoiceWebrtcTokenResponse & { error?: string; reason?: string })
        | { error?: string };

      if (!response.ok) {
        setWebrtcUnavailable(
          "Voice WebRTC token request failed. Confirm Africa's Talking credentials and feature flags.",
        );
        return;
      }

      if (!("mode" in payload) || payload.mode !== "webrtc" || !payload.token) {
        setWebrtcUnavailable(
          "Voice WebRTC is enabled in the browser but not configured on the server yet.",
        );
        return;
      }

      const adapter = new AfricasTalkingClientAdapter();
      adapterRef.current = adapter;
      adapterCleanupRef.current?.();
      adapterCleanupRef.current = attachAdapterListeners(adapter);
      const username = payload.identity.split(".")[0] || "";
      const registration: VoiceWebrtcRegistration = {
        token: payload.token,
        clientName: payload.clientName,
        identity: payload.identity,
        phoneNumber: payload.phoneNumber,
        username,
        expiresAt: payload.expiresAt,
      };
      await adapter.register(registration);
      webRtcRegistrationRef.current = registration;
      webRtcModeRef.current = "webrtc";
    } catch {
      await registerMockAdapter({
        statusMessage: "Africa's Talking WebRTC SDK failed to load. Falling back to mock mode.",
      }).catch(() => {
        webRtcModeRef.current = "unavailable";
        setTransportMode("unavailable");
        adapterRef.current = null;
        setState("ERROR");
        setAvailability("OFFLINE");
      });
    }
  };

  const unregister = async () => {
    adapterCleanupRef.current?.();
    adapterCleanupRef.current = null;
    if (adapterRef.current) {
      await adapterRef.current.unregister().catch(() => {});
      adapterRef.current = null;
    }
    webRtcRegistrationRef.current = null;
    webRtcModeRef.current = "mock";
    setTransportMode("mock");
    setStatusMessage(null);
    setCurrentCall(null);
    setAvailability("OFFLINE");
    setState("NOT_REGISTERED");
  };

  const answerCall = () => {
    if (adapterRef.current && webRtcModeRef.current === "webrtc") {
      void adapterRef.current.answer().catch(() => {
        setState("ERROR");
      });
    }
    setCurrentCall((call) => {
      if (!call) return call;
      return {
        ...call,
        state: "TALKING",
        startedAt: call.startedAt || new Date().toISOString(),
      };
    });
    setAvailability("TALKING");
    setState("TALKING");
  };

  const rejectCall = () => {
    if (adapterRef.current && webRtcModeRef.current === "webrtc") {
      void adapterRef.current.reject().catch(() => {
        setState("ERROR");
      });
    }
    setCurrentCall((call) => {
      if (!call) return call;
      pushRecentCall({ ...call, state: "DISCONNECTED" });
      return null;
    });
    setAvailability("AVAILABLE");
    setState("AVAILABLE");
  };

  const hangUp = () => {
    if (adapterRef.current && webRtcModeRef.current === "webrtc") {
      void adapterRef.current.hangup().catch(() => {
        setState("ERROR");
      });
    }
    setCurrentCall((call) => {
      if (!call) return call;
      pushRecentCall({ ...call, state: "DISCONNECTED" });
      return null;
    });
    setAvailability("AVAILABLE");
    setState("AVAILABLE");
  };

  const toggleMute = () => {
    const nextMuted = !Boolean(currentCallRef.current?.muted);
    if (adapterRef.current && webRtcModeRef.current === "webrtc") {
      void (nextMuted ? adapterRef.current.mute() : adapterRef.current.unmute()).catch(() => {
        setState("ERROR");
      });
    }
    setCurrentCall((call) => (call ? { ...call, muted: !call.muted } : call));
  };

  const toggleHold = () => {
    const nextHeld = !Boolean(currentCallRef.current?.held);
    if (adapterRef.current && webRtcModeRef.current === "webrtc") {
      void (nextHeld ? adapterRef.current.hold() : adapterRef.current.unhold()).catch(() => {
        setState("ERROR");
      });
    }
    setCurrentCall((call) => {
      if (!call) return call;
      const nextHeld = !call.held;
      setAvailability(nextHeld ? "BREAK" : "TALKING");
      setState(nextHeld ? "ON_HOLD" : "TALKING");
      return {
        ...call,
        held: nextHeld,
        state: nextHeld ? "ON_HOLD" : "TALKING",
      };
    });
  };

  const sendDtmf = (digit: string) => {
    if (adapterRef.current && webRtcModeRef.current === "webrtc") {
      void adapterRef.current.sendDtmf(digit).catch(() => {
        setState("ERROR");
      });
    }
    setCurrentCall((call) =>
      call
        ? {
            ...call,
            dtmfHistory: [...call.dtmfHistory, digit],
          }
        : call,
    );
  };

  const appendDigit = (digit: string) => {
    setDialedDigits((current) => `${current}${digit}`);
  };

  const startOutgoingCall = (target?: string) => {
    const phone = (target || dialedDigits || selectedCustomer?.phone || "").trim();
    if (!phone) return;
    const customer = selectedCustomer ?? buildDefaultMockCustomer(phone);
    const call = buildMockCall({
      direction: "OUTBOUND",
      state: "RINGING_OUTBOUND",
      phone,
      displayName: customer.name,
      customer,
    });
    setCurrentCall(call);
    setAvailability("BUSY");
    setState("RINGING_OUTBOUND");
    setDialedDigits("");
    if (adapterRef.current && webRtcModeRef.current === "webrtc") {
      void adapterRef.current.call(phone).catch(() => {
        setState("ERROR");
      });
    }
  };

  const triggerMockEvent = (event: SoftphoneMockEvent) => {
    switch (event) {
      case "incoming": {
        const customer = selectedCustomer ?? buildDefaultMockCustomer();
        const call = buildMockCall({
          direction: "INBOUND",
          state: "RINGING_INBOUND",
          phone: customer.phone,
          displayName: customer.name,
          customer,
        });
        setCurrentCall(call);
        setAvailability("RINGING");
        setState("RINGING_INBOUND");
        break;
      }
      case "outgoing":
        startOutgoingCall();
        break;
      case "answered":
        answerCall();
        break;
      case "rejected":
        rejectCall();
        break;
      case "ended":
        hangUp();
        break;
      case "hold":
        if (currentCall && !currentCall.held) toggleHold();
        break;
      case "resume":
        if (currentCall?.held) toggleHold();
        break;
      case "disconnect":
        setAvailability("OFFLINE");
        setState("DISCONNECTED");
        break;
      case "reconnect":
        setAvailability(currentCall ? (currentCall.held ? "BREAK" : currentCall.state === "TALKING" ? "TALKING" : "AVAILABLE") : "AVAILABLE");
        setState(currentCall ? currentCall.state : "AVAILABLE");
        break;
      case "transfer":
        setCurrentCall((call) =>
          call
            ? {
                ...call,
                dtmfHistory: [...call.dtmfHistory, "TRANSFERRED"],
              }
            : call,
        );
        break;
      default:
        break;
    }
  };

  const incomingCall = currentCall?.direction === "INBOUND" && currentCall.state === "RINGING_INBOUND" ? currentCall : null;

  const updatePreferences = (next: Partial<SoftphonePreferences>) => {
    setPreferences((current) => ({
      ...current,
      ...next,
      ringVolume:
        next.ringVolume == null ? current.ringVolume : normalizeSoftphoneVolume(next.ringVolume),
      outputVolume:
        next.outputVolume == null ? current.outputVolume : normalizeSoftphoneVolume(next.outputVolume),
    }));
  };

  const updateSipConfig = (next: Partial<SoftphoneSipConfig>) => {
    setSipConfig((current) => ({
      ...current,
      ...next,
    }));
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(SOFTPHONE_COLLAPSED_STORAGE_KEY);
    setIsCollapsed(stored == null ? true : stored === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SOFTPHONE_COLLAPSED_STORAGE_KEY, isCollapsed ? "1" : "0");
  }, [isCollapsed]);

  useEffect(() => {
    if (!session?.user || !preferences.autoRegister) return;
    if (!pathname.startsWith("/admin") && !pathname.startsWith("/attendant")) return;
    if (state !== "NOT_REGISTERED") return;
    void register();
  }, [pathname, preferences.autoRegister, session?.user, state]);

  useEffect(() => {
    if (!session?.user) {
      setAvailability("OFFLINE");
      setState("NOT_REGISTERED");
    }
  }, [session?.user]);

  useEffect(() => {
    if (!session?.user) return;
    if (state === "AVAILABLE" && availability === "OFFLINE") {
      setAvailability("AVAILABLE");
    }
  }, [availability, session?.user, state]);

  useEffect(() => {
    if (typeof document === "undefined" || !session?.user) return;
    const markAway = () => {
      if (currentCall) return;
      setAvailability(document.visibilityState === "hidden" ? "AWAY" : "AVAILABLE");
    };
    const markActive = () => {
      if (currentCall) return;
      setAvailability("AVAILABLE");
      if (activityTimerRef.current) window.clearTimeout(activityTimerRef.current);
      activityTimerRef.current = window.setTimeout(() => {
        if (!currentCall) setAvailability("AWAY");
      }, 60000);
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "focus"];
    const visibilityHandler = () => markAway();
    markActive();
    document.addEventListener("visibilitychange", visibilityHandler);
    events.forEach((eventName) => window.addEventListener(eventName, markActive));
    return () => {
      document.removeEventListener("visibilitychange", visibilityHandler);
      events.forEach((eventName) => window.removeEventListener(eventName, markActive));
      if (activityTimerRef.current) window.clearTimeout(activityTimerRef.current);
    };
  }, [currentCall, session?.user]);

  useEffect(() => {
    if (!session?.user) return;
    const syncPresence = async () => {
      setLastHeartbeatAt(new Date().toISOString());
      try {
        const registration = webRtcRegistrationRef.current;
        await fetch("/api/voice/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: mapAvailabilityToPresenceStatus(availability),
            currentCallId: currentCall?.id ?? null,
            webrtc: registration
              ? {
                  clientName: registration.clientName,
                  identity: registration.identity,
                  state: mapSoftphoneStateToWebrtcRegistryState(stateRef.current),
                }
              : {
                  state: mapSoftphoneStateToWebrtcRegistryState(stateRef.current),
                },
          }),
        });
      } catch {}
    };
    void syncPresence();
    const interval = window.setInterval(() => {
      void syncPresence();
    }, 45000);
    return () => window.clearInterval(interval);
  }, [availability, currentCall?.id, session?.user, state]);

  useEffect(() => {
    const audio = remoteAudioRef.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (!audio) return;
    audio.volume = Math.max(0.01, preferences.outputVolume / 100);
    if (preferences.speakerId && typeof audio.setSinkId === "function") {
      void audio.setSinkId(preferences.speakerId).catch(() => {});
    }
  }, [preferences.outputVolume, preferences.speakerId]);

  useEffect(() => {
    return () => {
      if (microphoneTestTimeoutRef.current) window.clearTimeout(microphoneTestTimeoutRef.current);
      if (speakerTestTimeoutRef.current) window.clearTimeout(speakerTestTimeoutRef.current);
      if (activityTimerRef.current) window.clearTimeout(activityTimerRef.current);
      stopMeter();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      adapterCleanupRef.current?.();
      adapterCleanupRef.current = null;
      void adapterRef.current?.unregister().catch(() => {});
      adapterRef.current = null;
    };
  }, []);

  const connectionStatus = useMemo<SoftphoneContextValue["connectionStatus"]>(() => {
    if (state === "ERROR") return "error";
    if (["DISCONNECTED", "NOT_REGISTERED"].includes(state)) return "warning";
    if (["AVAILABLE", "REGISTERED", "TALKING", "ON_HOLD", "RINGING_INBOUND", "RINGING_OUTBOUND", "BUSY"].includes(state)) {
      return "ready";
    }
    return "idle";
  }, [state]);

  const registrationStatus = useMemo<SoftphoneContextValue["registrationStatus"]>(() => {
    if (state === "REGISTERING") return "registering";
    if (["REGISTERED", "AVAILABLE", "RINGING_INBOUND", "RINGING_OUTBOUND", "TALKING", "ON_HOLD", "BUSY"].includes(state)) {
      return "registered";
    }
    if (state === "DISCONNECTED") return "disconnected";
    if (state === "ERROR") return "error";
    return "unregistered";
  }, [state]);

  const value = useMemo<SoftphoneContextValue>(
    () => ({
      state,
      stateLabel: getSoftphoneStateLabel(state),
      availability,
      availabilityLabel: getAvailabilityLabel(availability),
      transportMode,
      statusMessage,
      connectionStatus,
      registrationStatus,
      isRegistered: registrationStatus === "registered",
      isCollapsed,
      currentCall,
      incomingCall,
      recentCalls,
      favoriteNumbers: makeFavoriteNumbers(session?.user?.name),
      devices: {
        microphones,
        speakers,
      },
      preferences,
      sipConfig,
      microphonePermission,
      remoteAudioRef,
      dialedDigits,
      microphoneLevel,
      outputLevel,
      selectedCustomer,
      lastHeartbeatAt,
      hasSpeakerSelection:
        typeof window !== "undefined" &&
        typeof (HTMLMediaElement.prototype as HTMLMediaElement & { setSinkId?: unknown }).setSinkId === "function",
      register,
      unregister,
      requestMicrophoneAccess,
      refreshDevices,
      updatePreferences,
      updateSipConfig,
      setCollapsed: setIsCollapsed,
      setAvailability,
      appendDigit,
      backspaceDigit: () => setDialedDigits((current) => current.slice(0, -1)),
      clearDialPad: () => setDialedDigits(""),
      startOutgoingCall,
      answerCall,
      rejectCall,
      hangUp,
      toggleMute,
      toggleHold,
      sendDtmf,
      runSpeakerTest,
      runMicrophoneTest,
      triggerMockEvent,
      seedCustomerContext: setSelectedCustomer,
    }),
    [
      availability,
      connectionStatus,
      currentCall,
      dialedDigits,
      incomingCall,
      isCollapsed,
      lastHeartbeatAt,
      microphoneLevel,
      microphonePermission,
      microphones,
      outputLevel,
      preferences,
      recentCalls,
      registrationStatus,
      selectedCustomer,
      session?.user?.name,
      sipConfig,
      speakers,
      state,
      statusMessage,
      transportMode,
    ],
  );

  return (
    <SoftphoneContext.Provider value={value}>
      {children}
      <audio ref={remoteAudioRef} hidden playsInline />
    </SoftphoneContext.Provider>
  );
}

export function useSoftphone() {
  const context = useContext(SoftphoneContext);
  if (!context) {
    throw new Error("useSoftphone must be used within SoftphoneProvider");
  }
  return context;
}
