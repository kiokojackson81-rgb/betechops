import { normalizeKenyanPhone } from "@/lib/phone";

export type ProjectHandlerAssignment = {
  kind: "STAFF" | "EXTERNAL";
  staffId: string | null;
  staffName: string | null;
  externalAgentId: string | null;
  externalAgentName: string | null;
  phone: string | null;
};

export type ProjectExternalAgentSeed = {
  name: string;
  whatsappNumber: string;
};

export const DEFAULT_PROJECT_EXTERNAL_AGENTS: ProjectExternalAgentSeed[] = [
  { name: "Benard", whatsappNumber: "+254725305389" },
  { name: "Samuel", whatsappNumber: "+254113070356" },
];

const STAFF_PHONE_OVERRIDES: Array<{
  match: string[];
  phone: string;
}> = [
  {
    match: ["jonathan mugira", "jonathan"],
    phone: "+254731601259",
  },
  {
    match: ["evans"],
    phone: "+254114653461",
  },
];

function normalizeName(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeProjectHandlerPhone(phone: string | null | undefined) {
  return normalizeKenyanPhone(phone || undefined) || null;
}

export function resolveProjectStaffPhone(input: {
  name?: string | null;
  whatsappNumber?: string | null;
  phone?: string | null;
  technicalPhoneNumber?: string | null;
}) {
  const direct =
    normalizeProjectHandlerPhone(input.whatsappNumber) ||
    normalizeProjectHandlerPhone(input.phone) ||
    normalizeProjectHandlerPhone(input.technicalPhoneNumber);
  if (direct) return direct;

  const normalizedName = normalizeName(input.name);
  const matchedOverride = STAFF_PHONE_OVERRIDES.find((entry) =>
    entry.match.some((candidate) => normalizedName.includes(candidate)),
  );
  return matchedOverride ? matchedOverride.phone : null;
}

export function buildProjectHandlerSignature(assignment: ProjectHandlerAssignment) {
  return JSON.stringify({
    kind: assignment.kind,
    staffId: assignment.staffId,
    staffName: assignment.staffName,
    externalAgentId: assignment.externalAgentId,
    externalAgentName: assignment.externalAgentName,
    phone: assignment.phone,
  });
}
