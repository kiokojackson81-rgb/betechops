export type ReturnStatus =
  | "requested"
  | "approved"
  | "pickup_scheduled"
  | "picked_up"
  | "received"
  | "resolved"
  | "rejected";

export type EvidenceItem = { type: "photo" | "video" | "signature" | "document"; uri: string };

export type EvidencePolicy = {
  [category: string]: { photo?: number; signature?: number; video?: number; document?: number };
};

export function canTransition(from: ReturnStatus, to: ReturnStatus): boolean {
  const allowed: Record<ReturnStatus, ReturnStatus[]> = {
    requested: ["approved", "rejected"],
    approved: ["pickup_scheduled", "rejected"],
    pickup_scheduled: ["picked_up"],
    picked_up: ["received"],
    received: ["resolved"],
    resolved: [],
    rejected: [],
  };
  return allowed[from]?.includes(to) ?? false;
}

export function meetsEvidencePolicy(evidence: EvidenceItem[], category: string, policy: EvidencePolicy): boolean {
  const req = policy[category] || {};
  const count = (t: EvidenceItem["type"]) => evidence.filter((e) => e.type === t).length;
  if (req.photo && count("photo") < req.photo) return false;
  if (req.signature && count("signature") < req.signature) return false;
  if (req.video && count("video") < req.video) return false;
  if (req.document && count("document") < req.document) return false;
  return true;
}

export function guardTransition(
  from: ReturnStatus,
  to: ReturnStatus,
  opts: { role: "ADMIN" | "SUPERVISOR" | "ATTENDANT"; evidence?: EvidenceItem[]; category?: string; policy?: EvidencePolicy; received?: boolean }
): { ok: true } | { ok: false; reason: string } {
  if (!canTransition(from, to)) return { ok: false, reason: `Invalid transition ${from} -> ${to}` };

  // Role guards per step
  if (from === "requested" && to === "approved" && !(opts.role === "ADMIN" || opts.role === "SUPERVISOR")) {
    return { ok: false, reason: "Only Supervisor/Admin can approve" };
  }
  if (from === "approved" && to === "pickup_scheduled" && opts.role !== "SUPERVISOR" && opts.role !== "ADMIN") {
    return { ok: false, reason: "Only Supervisor can schedule pickup" };
  }
  if (from === "pickup_scheduled" && to === "picked_up" && opts.role !== "ATTENDANT" && opts.role !== "SUPERVISOR" && opts.role !== "ADMIN") {
    return { ok: false, reason: "Only Attendant/Supervisor/Admin can mark picked up" };
  }
  if (from === "picked_up" && to === "received" && !(opts.role === "SUPERVISOR" || opts.role === "ADMIN")) {
    return { ok: false, reason: "Only Supervisor/Admin can confirm received" };
  }
  if (from === "received" && to === "resolved" && opts.role !== "ADMIN") {
    return { ok: false, reason: "Only Admin can resolve" };
  }

  // Evidence guard: moving to picked_up requires minimum evidence for category
  if (from === "pickup_scheduled" && to === "picked_up") {
    const policy = opts.policy || {};
    const cat = opts.category || "default";
    const has = meetsEvidencePolicy(opts.evidence || [], cat, policy);
    if (!has) return { ok: false, reason: "Evidence requirements not met" };
  }

  // Resolution blocked unless already received
  if (to === "resolved" && !opts.received) return { ok: false, reason: "Cannot resolve before received" };

  return { ok: true };
}
