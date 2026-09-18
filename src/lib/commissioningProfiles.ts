export type CommissioningSystemProfile =
  | "SOLAR_PV_STORAGE"
  | "SOLAR_PV_NO_STORAGE"
  | "DC_SOLAR_KIT"
  | "SOLAR_WATER_PUMP"
  | "SOLAR_WATER_HEATER"
  | "BATTERY_BACKUP"
  | "CUSTOM";

export type ProfileEquipment = {
  kind: string;
  label: string;
  required?: boolean;
};

export type CommissioningProfile = {
  id: CommissioningSystemProfile;
  label: string;
  summary: string;
  panels: boolean;
  inverter: boolean;
  battery: boolean;
  extraEquipment: ProfileEquipment[];
  checklist: string[];
};

const standardChecklist = [
  "Protection devices installed",
  "Earthing connected",
  "Customer training completed",
];

export const COMMISSIONING_PROFILES: CommissioningProfile[] = [
  {
    id: "SOLAR_PV_STORAGE",
    label: "Solar PV with battery storage",
    summary: "Panels, inverter and battery",
    panels: true, inverter: true, battery: true, extraEquipment: [],
    checklist: ["Inverter powers ON", "PV charging detected", "Battery charging", "Battery discharging", "Grid input detected", "Backup/changeover tested", "Monitoring configured", ...standardChecklist],
  },
  {
    id: "SOLAR_PV_NO_STORAGE",
    label: "Solar PV without battery",
    summary: "Panels and inverter",
    panels: true, inverter: true, battery: false, extraEquipment: [],
    checklist: ["Inverter powers ON", "PV charging detected", "Grid input detected", "Monitoring configured", ...standardChecklist],
  },
  {
    id: "DC_SOLAR_KIT",
    label: "DC solar kit",
    summary: "Panels, battery and controller; inverter optional",
    panels: true, inverter: false, battery: true,
    extraEquipment: [{ kind: "controller", label: "Solar controller" }],
    checklist: ["PV charging detected", "Battery charging", "Battery discharging", ...standardChecklist],
  },
  {
    id: "SOLAR_WATER_PUMP",
    label: "Solar water pump",
    summary: "Panels, pump and controller; inverter optional",
    panels: true, inverter: false, battery: false,
    extraEquipment: [{ kind: "pump", label: "Water pump" }, { kind: "controller", label: "Pump controller" }],
    checklist: ["PV charging detected", "Pump operation tested", "Water flow verified", ...standardChecklist],
  },
  {
    id: "SOLAR_WATER_HEATER",
    label: "Solar water heater",
    summary: "Collector, tank and controller",
    panels: false, inverter: false, battery: false,
    extraEquipment: [{ kind: "collector", label: "Solar collector" }, { kind: "tank", label: "Hot water tank" }, { kind: "controller", label: "Heater controller" }],
    checklist: ["Collector installation inspected", "Tank installation inspected", "Pressure / leak test", "Hot water operation tested", ...standardChecklist],
  },
  {
    id: "BATTERY_BACKUP",
    label: "Battery backup / UPS",
    summary: "Battery and inverter; panels optional",
    panels: false, inverter: true, battery: true, extraEquipment: [],
    checklist: ["Inverter powers ON", "Battery charging", "Battery discharging", "Backup/changeover tested", ...standardChecklist],
  },
  {
    id: "CUSTOM",
    label: "Custom system",
    summary: "Choose and document the installed equipment",
    panels: false, inverter: false, battery: false, extraEquipment: [],
    checklist: ["System operation tested", ...standardChecklist],
  },
];

export function commissioningProfile(value: unknown): CommissioningProfile {
  const id = String(value || "").trim().toUpperCase() as CommissioningSystemProfile;
  return COMMISSIONING_PROFILES.find((profile) => profile.id === id)
    ?? COMMISSIONING_PROFILES[0];
}

export function profileFromCommissioningData(data: unknown) {
  const record = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};
  return commissioningProfile(record.systemProfile);
}
