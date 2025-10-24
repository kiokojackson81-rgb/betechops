import { prisma } from "@/lib/prisma";

export type EvidencePolicy = {
  [category: string]: { photo?: number; signature?: number; video?: number; document?: number };
};

const DEFAULT_POLICY: EvidencePolicy = {
  electronics: { photo: 2, signature: 1 },
};

export async function getEvidencePolicy(): Promise<EvidencePolicy> {
  try {
    const row = await prisma.config.findUnique({ where: { key: "returns_evidence_policy" } });
    if (row?.json) return row.json as EvidencePolicy;
  } catch {
    // ignore
  }
  return DEFAULT_POLICY;
}
