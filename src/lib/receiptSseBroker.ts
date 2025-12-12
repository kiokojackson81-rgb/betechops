import { EventEmitter } from "events";

const emitter = new EventEmitter();

// keep listener limit reasonable
emitter.setMaxListeners(100);

export type SummaryUpdatePayload = {
  attendantId?: string | null;
  receiptId?: string;
  timestamp?: string;
};

export const publishSummaryUpdate = (payload?: SummaryUpdatePayload) => {
  try {
    emitter.emit("summary", payload ?? { timestamp: new Date().toISOString() });
  } catch (err) {
    // best-effort
    console.warn("[receiptSseBroker] publish failed", err);
  }
};

export const subscribeSummary = (fn: (payload?: SummaryUpdatePayload) => void) => {
  emitter.on("summary", fn);
  return () => emitter.off("summary", fn);
};

export default {
  publishSummaryUpdate,
  subscribeSummary,
};
