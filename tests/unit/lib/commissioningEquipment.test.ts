import { commissioningEquipmentUnits, equipmentValidationErrors, projectEquipmentDefaults } from "@/lib/commissioningEquipment";
import { warrantyExpiry } from "@/lib/warrantyRules";
const extra = { id: "battery-2", kind: "battery", brand: "Test", model: "B", capacity: "5kWh", serial: "BAT-002", warrantyYears: "2", labelPhotos: [{ url: "https://example.invalid/label.jpg" }] };
const data = { equipment: { batterySerial: "BAT-001", batteryWarrantyYears: "5", inverterWarrantyYears: "2" }, additionalEquipment: [extra] };
test("warranty defaults prefer project items, then quoted items, then configured standard", () => {
  expect(projectEquipmentDefaults({ items: [{ name: "Lithium Battery", warrantyPeriod: 2, warrantyUnit: "YEARS" }] }, { items: [{ name: "Battery", warrantyPeriod: 10 }, { name: "Inverter", warranty: "5 years" }] })).toEqual({ panelWarrantyYears: "25", batteryWarrantyYears: "2", inverterWarrantyYears: "5" });
  expect(projectEquipmentDefaults({ warrantyMode: "FULL_SYSTEM", fullSystemWarranty: "2 years" }).batteryWarrantyYears).toBe("2");
});
test("separate batteries retain separate serials and editable warranties", () => {
  const units = commissioningEquipmentUnits(data);
  expect(units.filter(row => row.kind === "battery").map(row => [row.serial, row.warrantyYears])).toEqual([["BAT-001", "5"], ["BAT-002", "2"]]);
  expect(equipmentValidationErrors(data)).toEqual([]);
});
test("missing and duplicate unit serials or invalid warranty periods prevent certification", () => {
  for (const patch of [{ serial: "" }, { serial: "BAT-001" }, { warrantyYears: "-1" }, { warrantyYears: "100" }, { labelPhotos: [] }]) expect(equipmentValidationErrors({ ...data, additionalEquipment: [{ ...extra, ...patch }] }).length).toBeGreaterThan(0);
});
test("six month warranty preserves calendar dates", () => {
  expect(projectEquipmentDefaults({ items: [{ name: "Inverter", warrantyPeriod: 6, warrantyUnit: "MONTHS" }] }).inverterWarrantyYears).toBe("0.5");
  expect(warrantyExpiry(new Date("2026-09-14T00:00:00Z"), 0.5)).toBe("2027-03-13T00:00:00.000Z");
});
