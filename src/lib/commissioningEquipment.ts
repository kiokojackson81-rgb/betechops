import { profileFromCommissioningData } from "@/lib/commissioningProfiles";

export type EquipmentUnit = {
  id: string;
  kind: string;
  label?: string;
  brand: string;
  model: string;
  capacity: string;
  serial: string;
  warrantyYears: string;
  labelPhotos?: Array<{ url: string }>;
  installationPhotos?: Array<{ url: string }>;
};

export const equipmentRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export const DEFAULT_WARRANTY_YEARS = { panel: 25, inverter: 5, battery: 10 };

export function warrantyYearsFrom(value: unknown): number | null {
  const item = equipmentRecord(value);
  const period = Number(item.warrantyPeriod);
  if (Number.isFinite(period) && period > 0) return /month/i.test(String(item.warrantyUnit)) ? period / 12 : /day/i.test(String(item.warrantyUnit)) ? null : period;
  const text = String(item.warrantyText || item.warranty || item.warrantyPeriod || "");
  const match = text.match(/(\d+(?:\.\d+)?)\s*[- ]?\s*(years?|yrs?|months?)/i);
  return match ? Number(match[1]) / (/month/i.test(match[2]) ? 12 : 1) : null;
}

export function projectEquipmentDefaults(...sources: unknown[]): Record<string, string> {
  const rows = sources.flatMap(source => {
    const data = equipmentRecord(source);
    return [data, equipmentRecord(data.quotationData)].flatMap(record => [record.items, record.lineItems].flatMap(items => Array.isArray(items) ? items.map(equipmentRecord) : []));
  });
  const wholeSystemYears = sources.map(equipmentRecord).map(data => ["FULL_SYSTEM", "WHOLE_QUOTATION"].includes(String(data.warrantyMode)) ? warrantyYearsFrom({ warranty: data.fullSystemWarranty || data.customWarranty }) : null).find(years => years !== null);
  const result: Record<string, string> = {};
  for (const kind of ["panel", "inverter", "battery"] as const) {
    const matching = rows.filter(row => (kind === "battery" ? /battery|batteries/i : new RegExp(kind, "i")).test(String(row.name || row.title || row.description || "")));
    const row = matching.find(row => warrantyYearsFrom(row) !== null);
    result[`${kind}WarrantyYears`] = String(row ? warrantyYearsFrom(row) : wholeSystemYears ?? DEFAULT_WARRANTY_YEARS[kind]);
  }
  return result;
}

function unitFrom(value: unknown, fallback: Partial<EquipmentUnit> = {}): EquipmentUnit {
  const row = equipmentRecord(value);
  return {
    id: String(row.id || fallback.id || ""),
    kind: String(row.kind || fallback.kind || "custom"),
    label: String(row.label || fallback.label || ""),
    brand: String(row.brand || ""),
    model: String(row.model || ""),
    capacity: String(row.capacity || row.rating || ""),
    serial: String(row.serial || ""),
    warrantyYears: String(row.warrantyYears ?? fallback.warrantyYears ?? ""),
    labelPhotos: Array.isArray(row.labelPhotos) ? row.labelPhotos.map(equipmentRecord).map(photo => ({ url: String(photo.url || "") })).filter(photo => photo.url) : [],
    installationPhotos: Array.isArray(row.installationPhotos) ? row.installationPhotos.map(equipmentRecord).map(photo => ({ url: String(photo.url || "") })).filter(photo => photo.url) : [],
  };
}

export function commissioningEquipmentUnits(data: unknown): EquipmentUnit[] {
  const record = equipmentRecord(data);
  const equipment = equipmentRecord(record.equipment);
  const evidence = equipmentRecord(record.evidence);
  const profile = profileFromCommissioningData(record);
  const evidencePhotos = (key: string) => Array.isArray(evidence[key]) ? evidence[key].map(equipmentRecord).map((photo) => ({ url: String(photo.url || "") })).filter((photo) => photo.url) : [];
  const core = [
    ...(profile.inverter ? [unitFrom({ id: "inverter", kind: "inverter", label: "Inverter", brand: equipment.inverterBrand, model: equipment.inverterModel, capacity: equipment.inverterCapacity || equipment.inverterRating, serial: equipment.inverterSerial, warrantyYears: equipment.inverterWarrantyYears ?? DEFAULT_WARRANTY_YEARS.inverter, labelPhotos: evidencePhotos("inverterLabel") })] : []),
    ...(profile.battery ? [unitFrom({ id: "battery", kind: "battery", label: "Battery", brand: equipment.batteryBrand, model: equipment.batteryModel, capacity: equipment.batteryCapacity || equipment.batteryRating, serial: equipment.batterySerial, warrantyYears: equipment.batteryWarrantyYears ?? DEFAULT_WARRANTY_YEARS.battery, labelPhotos: evidencePhotos("batteryLabel") })] : []),
  ];
  const additional = Array.isArray(record.additionalEquipment) ? record.additionalEquipment.map(row => unitFrom(row)) : [];
  const system = Array.isArray(record.systemEquipment) ? record.systemEquipment.map(row => unitFrom(row)) : [];
  return [...core, ...additional, ...system];
}

function hasPhoto(unit: EquipmentUnit) {
  return Boolean(unit.labelPhotos?.some(photo => /^https:\/\//.test(photo.url)));
}

function validWarranty(unit: EquipmentUnit) {
  const years = Number(unit.warrantyYears);
  return unit.warrantyYears.trim() && Number.isFinite(years) && years > 0 && years <= 50 && Math.abs(years * 12 - Math.round(years * 12)) <= 0.00001;
}

export function equipmentValidationErrors(data: unknown): string[] {
  const record = equipmentRecord(data);
  const equipment = equipmentRecord(record.equipment);
  const profile = profileFromCommissioningData(record);
  const errors: string[] = [];
  const systemEquipment = Array.isArray(record.systemEquipment) ? record.systemEquipment.map(row => unitFrom(row)) : [];
  const additionalEquipment = Array.isArray(record.additionalEquipment) ? record.additionalEquipment.map(row => unitFrom(row)) : [];
  if (!Array.isArray(record.systemEquipment) && profile.extraEquipment.length) errors.push("Add the installed system equipment.");
  if (record.systemEquipment !== undefined && (!Array.isArray(record.systemEquipment) || record.systemEquipment.length > 48)) errors.push("Use at most 48 additional system equipment entries.");
  if (record.additionalEquipment !== undefined && (!Array.isArray(record.additionalEquipment) || record.additionalEquipment.length > 48)) errors.push("Use at most 48 additional equipment entries.");

  const units = commissioningEquipmentUnits(record);
  const ids = new Set<string>();
  const serials = new Set<string>();
  for (const unit of units) {
    const name = unit.label || unit.kind || "equipment";
    if (ids.has(unit.id) || !unit.id) errors.push("Each equipment entry needs a unique identifier.");
    ids.add(unit.id);
    if (!unit.serial.trim() || /^(n\/?a|unknown|not recorded|-)$/i.test(unit.serial.trim())) errors.push(`${name}: serial number is required.`);
    const serial = unit.serial.trim().toUpperCase();
    if (serial && serials.has(serial)) errors.push(`Duplicate serial number: ${unit.serial}`);
    if (serial) serials.add(serial);
    if ([unit.brand, unit.model, unit.capacity, unit.serial].some(value => value.length > 180)) errors.push(`${name}: equipment fields must be at most 180 characters.`);
    if (!hasPhoto(unit)) errors.push(`${name}: upload a photo showing this unit's label and serial number.`);
    if (!validWarranty(unit)) errors.push(`${name}: enter a warranty from 1 month to 50 years.`);
  }

  if (profile.panels) {
    const panelYears = Number(equipment.panelWarrantyYears ?? DEFAULT_WARRANTY_YEARS.panel);
    if (!Number.isFinite(panelYears) || panelYears <= 0 || panelYears > 50 || Math.abs(panelYears * 12 - Math.round(panelYears * 12)) > 0.00001) errors.push("Panels: enter a warranty from 1 month to 50 years.");
  }
  for (const required of profile.extraEquipment) {
    if (!systemEquipment.some(unit => unit.kind === required.kind)) errors.push(`${required.label}: add the installed equipment record.`);
  }
  if (profile.id === "CUSTOM" && !systemEquipment.length && !additionalEquipment.length) errors.push("Custom system: add at least one installed equipment record.");
  return errors;
}
