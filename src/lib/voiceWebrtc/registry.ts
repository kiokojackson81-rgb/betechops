type VoiceWebrtcRegistryEntry = {
  userId: string;
  clientName: string;
  identity: string;
  state: "ready" | "notready" | "offline" | "closed" | "error";
  updatedAt: Date;
};

const REGISTRY_STALE_MS = 90 * 1000;
const registry = new Map<string, VoiceWebrtcRegistryEntry>();

export function updateVoiceWebrtcRegistry(input: {
  userId: string;
  clientName: string;
  identity: string;
  state: VoiceWebrtcRegistryEntry["state"];
}) {
  const entry: VoiceWebrtcRegistryEntry = {
    userId: input.userId,
    clientName: input.clientName,
    identity: input.identity,
    state: input.state,
    updatedAt: new Date(),
  };
  registry.set(input.userId, entry);
  return entry;
}

export function clearVoiceWebrtcRegistry(userId: string) {
  registry.delete(userId);
}

export function getVoiceWebrtcRegistryEntry(userId: string) {
  const entry = registry.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt.getTime() > REGISTRY_STALE_MS) {
    registry.delete(userId);
    return null;
  }
  return entry;
}

export function isVoiceWebrtcClientReady(userId: string) {
  const entry = getVoiceWebrtcRegistryEntry(userId);
  return entry?.state === "ready" ? entry : null;
}

export function listVoiceWebrtcRegistryEntries() {
  return Array.from(registry.values()).filter(
    (entry) => Date.now() - entry.updatedAt.getTime() <= REGISTRY_STALE_MS,
  );
}
