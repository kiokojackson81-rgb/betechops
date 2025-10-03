export type Decimalish = number | string;

export type ItemInputs = {
  sellPrice: Decimalish;
  qty: number;
  settlement: {
    commission: Decimalish[];
    penalty: Decimalish[];
    shipping_fee: Decimalish[];
    refund: Decimalish[];
  };
  unitCost: Decimalish; // from override or catalog
};

const toNum = (v: Decimalish): number => Number(v);
const sum = (a: Decimalish[]): number => a.reduce<number>((t, x) => t + toNum(x), 0);

export function computeProfit(inputs: ItemInputs) {
  const revenue: number = toNum(inputs.sellPrice) * inputs.qty;
  const fees: number = sum(inputs.settlement.commission) + sum(inputs.settlement.penalty);
  const shipping: number = sum(inputs.settlement.shipping_fee);
  const refunds: number = sum(inputs.settlement.refund);
  const unitCost: number = toNum(inputs.unitCost);
  const profit: number = revenue - unitCost * inputs.qty - fees - shipping + refunds;
  return { revenue, fees, shipping, refunds, unitCost, qty: inputs.qty, profit };
}
