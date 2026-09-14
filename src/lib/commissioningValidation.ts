const hasTermsAcceptance = (data: Record<string, unknown>) => Boolean(data.termsAcceptance && typeof data.termsAcceptance === "object" && (data.termsAcceptance as Record<string, unknown>).accepted === true);

export function isReadyToIssue(data: Record<string, unknown>) {
  const evidence = data.evidence && typeof data.evidence === "object" ? data.evidence as Record<string, unknown> : {};
  const signatures = data.signatures && typeof data.signatures === "object" ? data.signatures as Record<string, unknown> : {};
  const checklist = data.checklist && typeof data.checklist === "object" ? data.checklist as Record<string, unknown> : {};
  const handover = data.handover && typeof data.handover === "object" ? data.handover as Record<string, unknown> : {};
  const requiredEvidence = ["panelLabel", "panelArray", "inverterLabel", "inverterInstallation", "batteryLabel", "batteryInstallation", "protection", "overall"];
  const requiredChecklist = ["Inverter powers ON", "PV charging detected", "Battery charging", "Battery discharging", "Grid input detected", "Backup/changeover tested", "Protection devices installed", "Earthing connected", "Monitoring configured", "Customer training completed"];
  const requiredHandover = ["System operation", "Shutdown/startup", "Monitoring", "Warranty", "Load limitations", "Maintenance", "Fault reporting"];
  const missingEvidence = requiredEvidence.filter((key) => !Array.isArray(evidence[key]) || !(evidence[key] as unknown[]).some(item => item && typeof item === "object" && /^https:\/\//.test(String((item as Record<string, unknown>).url || ""))));
  const installation = data.installation as Record<string, unknown> | undefined;
  const equipment = data.equipment as Record<string, unknown> | undefined;
  const missingEquipment = [!String(equipment?.batterySerial || "").trim() || /^(n\/?a|not recorded|unknown|-)$/i.test(String(equipment?.batterySerial)) ? "Battery serial number" : null, !["Hybrid", "Off-Grid", "Grid-Tied"].includes(String(installation?.systemConfiguration)) ? "System configuration" : null].filter(Boolean);
  const missingChecklist = requiredChecklist.filter((key) => !["PASS", "N/A"].includes(String(checklist[key])));
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
