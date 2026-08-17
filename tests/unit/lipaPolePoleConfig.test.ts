import {
  getLipaPolePoleDefaultInstallments,
  getLipaPolePoleMaxInstallments,
} from "@/lib/lipaPolePoleConfig";

describe("Lipa Pole Pole period policy", () => {
  test("defaults monthly plans to six months", () => {
    expect(getLipaPolePoleDefaultInstallments("MONTHLY")).toBe(6);
  });

  test("caps monthly plans at six months", () => {
    expect(getLipaPolePoleMaxInstallments("MONTHLY")).toBe(6);
  });

  test("caps weekly plans at the six-month equivalent", () => {
    expect(getLipaPolePoleDefaultInstallments("WEEKLY")).toBe(26);
    expect(getLipaPolePoleMaxInstallments("WEEKLY")).toBe(26);
  });
});
