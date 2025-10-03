export type Rule = {
  id: string;
  scope: "sku" | "category" | "shop" | "global";
  shopId?: string | null;
  sku?: string | null;
  category?: string | null;
  type: "percent_profit" | "percent_gross" | "flat_per_item";
  rateDecimal: number; // decimal fraction e.g., 0.05
  effectiveFrom: Date;
  effectiveTo?: Date | null;
};

export type Basis = {
  revenue: number;
  profit: number;
  qty: number;
  sku: string;
  category?: string | null;
  shopId?: string | null;
  at: Date;
};

export function isActive(rule: Rule, at: Date) {
  const fromOk = rule.effectiveFrom <= at;
  const toOk = !rule.effectiveTo || at <= rule.effectiveTo;
  return fromOk && toOk;
}

export function pickRule(rules: Rule[], basis: Basis): Rule | undefined {
  const active = rules.filter((r) => isActive(r, basis.at));
  // priority sku > category > shop > global
  const bySku = active.find((r) => r.scope === "sku" && r.sku === basis.sku);
  if (bySku) return bySku;
  const byCat = active.find((r) => r.scope === "category" && r.category && r.category === basis.category);
  if (byCat) return byCat;
  const byShop = active.find((r) => r.scope === "shop" && r.shopId && r.shopId === basis.shopId);
  if (byShop) return byShop;
  return active.find((r) => r.scope === "global");
}

export function computeCommission(rule: Rule, basis: Basis): { amount: number; detail: Record<string, unknown> } {
  const detail: Record<string, unknown> = { ruleId: rule.id, type: rule.type, rate: rule.rateDecimal };
  let amount = 0;
  switch (rule.type) {
    case "percent_profit":
      amount = basis.profit * rule.rateDecimal;
      break;
    case "percent_gross":
      amount = basis.revenue * rule.rateDecimal;
      break;
    case "flat_per_item":
      amount = rule.rateDecimal * basis.qty; // interpret rateDecimal as flat KES
      break;
  }
  return { amount, detail };
}

export function reverseCommission(amount: number): number {
  return -Math.abs(amount);
}
