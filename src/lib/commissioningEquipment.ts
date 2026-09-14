export type EquipmentUnit = { id: string; kind: "inverter" | "battery"; brand: string; model: string; capacity: string; serial: string; warrantyYears: string; labelPhotos?: Array<{ url: string }>; installationPhotos?: Array<{ url: string }> };
export const equipmentRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
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
export function commissioningEquipmentUnits(data: unknown): EquipmentUnit[] {
  const record = equipmentRecord(data), equipment = equipmentRecord(record.equipment);
  return [
    ...(["inverter", "battery"] as const).map(kind => ({ id: kind, kind, brand: String(equipment[`${kind}Brand`] || ""), model: String(equipment[`${kind}Model`] || ""), capacity: String(equipment[`${kind}Capacity`] || equipment[`${kind}Rating`] || ""), serial: String(equipment[`${kind}Serial`] || ""), warrantyYears: String(equipment[`${kind}WarrantyYears`] ?? DEFAULT_WARRANTY_YEARS[kind]) })),
    ...(Array.isArray(record.additionalEquipment) ? record.additionalEquipment.map(equipmentRecord).map(row => ({ ...row, id: String(row.id || ""), kind: row.kind as "inverter" | "battery", brand: String(row.brand || ""), model: String(row.model || ""), capacity: String(row.capacity || ""), serial: String(row.serial || ""), warrantyYears: String(row.warrantyYears ?? "") })) : []),
  ];
}
export function equipmentValidationErrors(data: unknown): string[] {
  const record = equipmentRecord(data), equipment = equipmentRecord(record.equipment);
  const errors: string[] = [];
  if (record.additionalEquipment !== undefined && (!Array.isArray(record.additionalEquipment) || record.additionalEquipment.length > 48)) errors.push("Use at most 50 inverter and battery units.");
  const seen = new Set<string>();
  const ids = new Set<string>();
  for (const unit of commissioningEquipmentUnits(data)) {
    if (!["battery", "inverter"].includes(unit.kind)) errors.push("Select a valid equipment type.");
    if (ids.has(unit.id) || !unit.id) errors.push("Each equipment entry needs a unique identifier.");
    ids.add(unit.id);
    if ((unit.kind === "battery" || unit.id !== unit.kind) && (!unit.serial.trim() || /^(n\/?a|unknown|not recorded|-)$/i.test(unit.serial.trim()))) errors.push(`${unit.kind}: serial number is required.`);
    const serial = unit.serial.trim().toUpperCase();
    if (serial && seen.has(serial)) errors.push(`Duplicate serial number: ${unit.serial}`);
    if (serial) seen.add(serial);
    if ([unit.brand, unit.model, unit.capacity, unit.serial].some(value => value.length > 180)) errors.push(`${unit.kind}: equipment fields must be at most 180 characters.`);
    if (unit.id !== unit.kind && !unit.labelPhotos?.some(photo => /^https:\/\//.test(photo.url))) errors.push(`${unit.kind}: upload a photo showing this unit's label and serial number.`);
    const years = Number(unit.warrantyYears);
    if (!unit.warrantyYears.trim() || !Number.isFinite(years) || years <= 0 || years > 50 || Math.abs(years * 12 - Math.round(years * 12)) > 0.00001) errors.push(`${unit.kind}: enter a warranty from 1 month to 50 years.`);
  }
  const panelYears = Number(equipment.panelWarrantyYears ?? DEFAULT_WARRANTY_YEARS.panel);
  if (!Number.isFinite(panelYears) || panelYears <= 0 || panelYears > 50 || Math.abs(panelYears * 12 - Math.round(panelYears * 12)) > 0.00001) errors.push("Panels: enter a warranty from 1 month to 50 years.");
  return errors;
}
