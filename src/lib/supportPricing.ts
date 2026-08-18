type ReceiptPayloadItem = {
  title?: unknown;
  productName?: unknown;
  name?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  sellingPrice?: unknown;
  isDeliveryFee?: unknown;
};

type SupportReceiptItemLike = {
  id: string;
  productName?: string | null;
  pricedAt?: Date | null;
  createdAt?: Date | null;
};

const SUPPORT_ITEM_MARKER = "[support-item:";
const DELIVERY_FEE_RE = /delivery\s*fee/i;

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeName = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

export const isDeliveryFeeLabel = (value: unknown) => DELIVERY_FEE_RE.test(String(value ?? "").trim());

export const isDeliveryFeePayloadItem = (item: ReceiptPayloadItem | null | undefined) =>
  Boolean(item?.isDeliveryFee) || isDeliveryFeeLabel(item?.title ?? item?.productName ?? item?.name);

export const encodeSupportSaleProduct = (productName: string, receiptItemId: string) =>
  `${productName.trim() || "Item"} ${SUPPORT_ITEM_MARKER}${receiptItemId}]`;

export const decodeSupportSaleProduct = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/\s*\[support-item:[^\]]+\]\s*$/i, "")
    .trim();

export function allocateSupportSellingShares(
  receiptItems: ReceiptPayloadItem[],
  supportItems: SupportReceiptItemLike[],
  receiptSellingTotal?: number,
): Map<string, number> {
  const deliveryTotal = receiptItems
    .filter((item) => isDeliveryFeePayloadItem(item))
    .reduce((sum, item) => {
      const quantity = Math.max(1, Math.trunc(toNumber(item.quantity || 1)));
      const unitPrice = toNumber(item.unitPrice ?? item.sellingPrice);
      return sum + quantity * unitPrice;
    }, 0);

  const nonDeliveryPayloads = receiptItems
    .filter((item) => !isDeliveryFeePayloadItem(item))
    .map((item, index) => {
      const title = String(item.title ?? item.productName ?? item.name ?? "").trim() || "Item";
      const quantity = Math.max(1, Math.trunc(toNumber(item.quantity || 1)));
      const unitPrice = toNumber(item.unitPrice ?? item.sellingPrice);
      return {
        index,
        normalizedTitle: normalizeName(title),
        sellingTotal: quantity * unitPrice,
      };
    });

  const payloadIndexesByTitle = new Map<string, number[]>();
  nonDeliveryPayloads.forEach((item, index) => {
    const bucket = payloadIndexesByTitle.get(item.normalizedTitle) ?? [];
    bucket.push(index);
    payloadIndexesByTitle.set(item.normalizedTitle, bucket);
  });

  const unmatchedIndexes = nonDeliveryPayloads.map((_, index) => index);
  const shares = new Map<string, number>();

  for (const item of supportItems) {
    const normalizedTitle = normalizeName(item.productName);
    let payloadIndex: number | undefined;

    const matchedByName = payloadIndexesByTitle.get(normalizedTitle);
    if (matchedByName && matchedByName.length > 0) {
      payloadIndex = matchedByName.shift();
      const unmatchedIndex = unmatchedIndexes.indexOf(payloadIndex ?? -1);
      if (unmatchedIndex >= 0) unmatchedIndexes.splice(unmatchedIndex, 1);
    } else if (unmatchedIndexes.length > 0) {
      payloadIndex = unmatchedIndexes.shift();
    }

    const sellingTotal =
      typeof payloadIndex === "number" && nonDeliveryPayloads[payloadIndex]
        ? nonDeliveryPayloads[payloadIndex].sellingTotal
        : 0;
    shares.set(item.id, sellingTotal);
  }

  const deliveryTarget = [...supportItems]
    .filter((item) => item.pricedAt instanceof Date)
    .sort((a, b) => {
      const pricedDelta = (a.pricedAt?.getTime() ?? 0) - (b.pricedAt?.getTime() ?? 0);
      if (pricedDelta !== 0) return pricedDelta;
      return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
    })[0];

  if (deliveryTarget && deliveryTotal > 0) {
    shares.set(deliveryTarget.id, (shares.get(deliveryTarget.id) ?? 0) + deliveryTotal);
  }

  const targetTotal = Math.max(0, Math.round(toNumber(receiptSellingTotal)));
  const allocatedTotal = [...shares.values()].reduce((sum, value) => sum + value, 0);
  if (supportItems.length > 0 && targetTotal > 0 && Math.round(allocatedTotal) !== targetTotal) {
    const weights = supportItems.map((item) => Math.max(0, shares.get(item.id) ?? 0));
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    let remainder = targetTotal;

    supportItems.forEach((item, index) => {
      const share =
        index === supportItems.length - 1
          ? remainder
          : Math.floor(
              weightTotal > 0
                ? (weights[index] / weightTotal) * targetTotal
                : targetTotal / supportItems.length,
            );
      shares.set(item.id, share);
      remainder -= share;
    });
  }

  return shares;
}
