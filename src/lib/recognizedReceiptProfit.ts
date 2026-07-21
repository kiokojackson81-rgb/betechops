import { adjustProfitForPodDeliveryFee } from "@/lib/podDeliveryFee";

type MaybeNumber = number | string | null | undefined;

export type RecognizedReceiptProfitLine = {
  quantity?: MaybeNumber;
  sellingPrice?: MaybeNumber;
  buyingPrice?: MaybeNumber;
};

export type RecognizedReceiptProfitInput = {
  items: RecognizedReceiptProfitLine[];
  aggregateSellingTotal?: MaybeNumber;
  aggregateBuyingTotal?: MaybeNumber;
  commissionTotal?: MaybeNumber;
  deliveryFee?: MaybeNumber;
};

export type RecognizedReceiptProfitResult = {
  recognizedSellingTotal: number;
  recognizedBuyingTotal: number;
  recognizedProfit: number;
  pricedItemsCount: number;
  totalItemsCount: number;
  hasAnyPricedItems: boolean;
  allItemsPriced: boolean;
  hasPendingItems: boolean;
};

const toNumber = (value: MaybeNumber) => {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
};

const toQty = (value: MaybeNumber) => {
  const qty = Math.trunc(toNumber(value));
  return qty > 0 ? qty : 1;
};

export function computeRecognizedReceiptProfit(
  input: RecognizedReceiptProfitInput,
): RecognizedReceiptProfitResult {
  const items = Array.isArray(input.items) ? input.items : [];
  const totalItemsCount = items.length;
  const normalized = items.map((item) => {
    const quantity = toQty(item?.quantity);
    const sellingPrice = Math.max(0, toNumber(item?.sellingPrice));
    const buyingPrice = Math.max(0, toNumber(item?.buyingPrice));
    const priced = buyingPrice > 0;
    return { quantity, sellingPrice, buyingPrice, priced };
  });

  const pricedItems = normalized.filter((item) => item.priced);
  const pricedItemsCount = pricedItems.length;
  const hasAnyPricedItems = pricedItemsCount > 0;
  const allItemsPriced = totalItemsCount > 0 && pricedItemsCount === totalItemsCount;
  const hasPendingItems = totalItemsCount > 0 && pricedItemsCount < totalItemsCount;

  const recognizedSellingFromItems = pricedItems.reduce(
    (sum, item) => sum + item.sellingPrice * item.quantity,
    0,
  );
  const recognizedBuyingFromItems = pricedItems.reduce(
    (sum, item) => sum + item.buyingPrice * item.quantity,
    0,
  );

  const aggregateSellingTotal = Math.max(0, toNumber(input.aggregateSellingTotal));
  const aggregateBuyingTotal = Math.max(0, toNumber(input.aggregateBuyingTotal));
  const commissionTotal = Math.max(0, toNumber(input.commissionTotal));
  const deliveryFee = Math.max(0, toNumber(input.deliveryFee));

  const recognizedSellingTotal =
    allItemsPriced && aggregateSellingTotal > 0 ? aggregateSellingTotal : recognizedSellingFromItems;
  const recognizedBuyingTotal =
    allItemsPriced && aggregateBuyingTotal > 0 ? aggregateBuyingTotal : recognizedBuyingFromItems;

  const rawProfit = recognizedSellingTotal - recognizedBuyingTotal - commissionTotal;
  const recognizedProfit =
    allItemsPriced && recognizedSellingTotal > 0
      ? adjustProfitForPodDeliveryFee(rawProfit, deliveryFee)
      : rawProfit;

  return {
    recognizedSellingTotal,
    recognizedBuyingTotal,
    recognizedProfit,
    pricedItemsCount,
    totalItemsCount,
    hasAnyPricedItems,
    allItemsPriced,
    hasPendingItems,
  };
}
