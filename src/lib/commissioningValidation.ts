import { equipmentValidationErrors } from "@/lib/commissioningEquipment";
import { profileFromCommissioningData } from "@/lib/commissioningProfiles";

const hasTermsAcceptance = (data: Record<string, unknown>) =>
  Boolean(data.termsAcceptance && typeof data.termsAcceptance === "object" && (data.termsAcceptance as Record<string, unknown>).accepted === true);

const hasPhoto = (evidence: Record<string, unknown>, key: string) =>
  Array.isArray(evidence[key]) && (evidence[key] as unknown[]).some(item => item && typeof item === "object" && /^https:\/\//.test(String((item as Record<string, unknown>).url || "")));

export function isReadyToIssue(data: Record<string, unknown>) {
  const evidence = data.evidence && typeof data.evidence === "object" ? data.evidence as Record<string, unknown> : {};
  const signatures = data.signatures && typeof data.signatures === "object" ? data.signatures as Record<string, unknown> : {};
  const checklist = data.checklist && typeof data.checklist === "object" ? data.checklist as Record<string, unknown> : {};
  const handover = data.handover && typeof data.handover === "object" ? data.handover as Record<string, unknown> : {};
  const installation = data.installation as Record<string, unknown> | undefined;
  const profile = profileFromCommissioningData(data);
  const requiredEvidence = [
    ...(profile.panels ? ["panelLabel", "panelArray"] : []),
    ...(profile.inverter ? ["inverterLabel", "inverterInstallation"] : []),
    ...(profile.battery ? ["batteryLabel", "batteryInstallation"] : []),
    "protection",
    "overall",
  ];
  const requiredHandover = ["System operation", "Shutdown/startup", "Warranty", "Maintenance", "Fault reporting"];
  const missingEvidence = requiredEvidence.filter((key) => !hasPhoto(evidence, key));
  const missingEquipment = [
    ...equipmentValidationErrors(data),
    !String(data.systemProfile || "").trim() ? "System type" : null,
    !String(installation?.type || "").trim() ? "Installation type" : null,
    !String(installation?.systemConfiguration || "").trim() ? "System configuration" : null,
  ].filter(Boolean);
  const missingChecklist = profile.checklist.filter((key) => !["PASS", "N/A"].includes(String(checklist[key])));
  const missingHandover = requiredHandover.filter((key) => handover[key] !== true);
  return {
    ready: missingEquipment.length === 0 && missingEvidence.length === 0 && missingChecklist.length === 0 && missingHandover.length === 0 && hasTermsAcceptance(data) && Boolean(signatures.customer) && Boolean(signatures.technician),
    missingEquipment,
    missingEvidence,
    missingChecklist,
    missingHandover,
    termsAccepted: hasTermsAcceptance(data),
    missingSignatures: [!signatures.customer ? "customer" : null, !signatures.technician ? "technician" : null].filter(Boolean),
    checklistComplete: missingChecklist.length === 0,
  };
}
