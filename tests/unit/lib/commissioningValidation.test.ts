import { isReadyToIssue } from "@/lib/commissioningValidation";

function completed() {
  return {
    equipment: { batterySerial: "BATTERY-TEST-001" }, installation: { systemConfiguration: "Hybrid" },
    evidence: Object.fromEntries(["panelLabel", "panelArray", "inverterLabel", "inverterInstallation", "batteryLabel", "batteryInstallation", "protection", "overall"].map(key => [key, [{ url: "https://example.invalid/evidence.jpg" }]])),
    checklist: Object.fromEntries(["Inverter powers ON", "PV charging detected", "Battery charging", "Battery discharging", "Grid input detected", "Backup/changeover tested", "Protection devices installed", "Earthing connected", "Monitoring configured", "Customer training completed"].map(key => [key, "PASS"])),
    handover: Object.fromEntries(["System operation", "Shutdown/startup", "Monitoring", "Warranty", "Load limitations", "Maintenance", "Fault reporting"].map(key => [key, true])),
    termsAcceptance: { accepted: true }, signatures: { customer: "signed", technician: "signed" },
  };
}

test("requires successful commissioning and explicit customer acceptance", () => {
  const data = completed();
  expect(isReadyToIssue(data).ready).toBe(true);
  data.checklist["Battery charging"] = "FAIL";
  expect(isReadyToIssue(data).ready).toBe(false);
  data.checklist["Battery charging"] = "N/A";
  expect(isReadyToIssue(data).ready).toBe(true);
  data.termsAcceptance.accepted = false;
  expect(isReadyToIssue(data).ready).toBe(false);
});

test("prevents missing battery serials and marketing descriptions being finalized", () => {
  const data = completed();
  data.equipment.batterySerial = "Not recorded";
  expect(isReadyToIssue(data).ready).toBe(false);
  data.equipment.batterySerial = "SERIAL-123";
  data.installation.systemConfiguration = "Hybrid package with transport";
  expect(isReadyToIssue(data).ready).toBe(false);
});

test("requires evidence and both signatures", () => {
  const data = completed();
  data.signatures.customer = "";
  expect(isReadyToIssue(data).ready).toBe(false);
  data.signatures.customer = "signed";
  data.evidence.panelArray = [];
  expect(isReadyToIssue(data).ready).toBe(false);
});
