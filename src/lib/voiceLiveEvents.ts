type VoiceLiveEventType =
  | "snapshot"
  | "presence"
  | "call"
  | "queue"
  | "note"
  | "follow_up"
  | "recording"
  | "health";

type VoiceLiveEvent = {
  type: VoiceLiveEventType;
  reason: string;
  callId?: string | null;
  sessionId?: string | null;
  userId?: string | null;
  ts: string;
};

type VoiceLiveListener = (event: VoiceLiveEvent) => void;

declare global {
  // eslint-disable-next-line no-var
  var __betechVoiceLiveListeners: Set<VoiceLiveListener> | undefined;
}

function getVoiceLiveListeners() {
  if (!globalThis.__betechVoiceLiveListeners) {
    globalThis.__betechVoiceLiveListeners = new Set<VoiceLiveListener>();
  }
  return globalThis.__betechVoiceLiveListeners;
}

export function publishVoiceLiveEvent(event: Omit<VoiceLiveEvent, "ts">) {
  const payload: VoiceLiveEvent = {
    ...event,
    ts: new Date().toISOString(),
  };

  for (const listener of getVoiceLiveListeners()) {
    try {
      listener(payload);
    } catch (error) {
      console.error("[voice.live.listener_failed]", error);
    }
  }
}

export function subscribeVoiceLiveEvent(listener: VoiceLiveListener) {
  const listeners = getVoiceLiveListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
