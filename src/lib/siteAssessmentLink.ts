import { createHmac, timingSafeEqual } from "crypto";

export type AssessmentLinkAudience = "TECHNICIAN" | "CUSTOMER";
type AssessmentLinkPayload = { visitId: string; technicianId?: string; expiresAt: number; audience?: AssessmentLinkAudience };

function secret() {
  const value = process.env.SITE_ASSESSMENT_LINK_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("SITE_ASSESSMENT_LINK_SECRET must be configured.");
  return value;
}

function signature(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSiteAssessmentToken(input: Omit<AssessmentLinkPayload, "expiresAt">, hours = 72) {
  const payload: AssessmentLinkPayload = { ...input, expiresAt: Date.now() + hours * 60 * 60 * 1000 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function verifySiteAssessmentToken(token: string): AssessmentLinkPayload | null {
  const [encoded, receivedSignature] = token.split(".");
  if (!encoded || !receivedSignature) return null;
  const expectedSignature = signature(encoded);
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AssessmentLinkPayload;
    const validAudience = !payload.audience || payload.audience === "TECHNICIAN" || payload.audience === "CUSTOMER";
    const validTechnicianLink = payload.audience !== "CUSTOMER" ? Boolean(payload.technicianId) : true;
    return payload.visitId && payload.expiresAt > Date.now() && validAudience && validTechnicianLink
      ? payload
      : null;
  } catch { return null; }
}
