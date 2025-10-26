export type NormalizedOrder = {
  platform: 'JUMIA' | 'KILIMALL';
  shopId: string;
  externalOrderId: string;
  status: string;
  buyer?: { name?: string; phone?: string };
  orderedAt: string;
  items: Array<{
    externalSku: string;
    title: string;
    qty: number;
    salePrice: number;
    fees?: { commission?: number; shipping?: number; tax?: number };
  }>;
};

// TODO(copilot): Extend normalizeFromJumia(order) to include:
// - shopIds[] (if orders can belong to multiple shops)
// - number (order number), totals (totalAmount, currency), deliveryOption
// - pendingSince (first seen pending timestamp)
// - preserve raw timestamps as UTC in a `raw` field for troubleshooting

export function normalizeFromJumia(raw: unknown, shopId: string): NormalizedOrder {
  // Minimal defensive mapping. Real mapping should be expanded to match Jumia payload.
  const rawObj = (raw || {}) as Record<string, unknown>;
  const itemsArr = (rawObj.items || rawObj.orderItems || []) as unknown[];
  const items = itemsArr.map((it: unknown) => {
    const obj = (it || {}) as Record<string, unknown>;
    return {
      externalSku: (obj.sku as string) || (obj.spu as string) || String(obj.product_sku || obj.sku || ""),
      title: (obj.title as string) || (obj.name as string) || "",
      qty: Number(obj.quantity ?? obj.qty ?? 1),
      salePrice: Number(obj.price ?? obj.selling_price ?? 0),
      fees: {
        commission: Number(obj.commission ?? obj.fee ?? 0),
        shipping: Number(obj.shipping ?? 0),
        tax: Number(obj.tax ?? 0),
      },
    };
  });

  return {
    platform: 'JUMIA',
    shopId,
    externalOrderId: String(rawObj.externalId || rawObj.orderId || rawObj.order_number || rawObj.orderNumber),
    status: (rawObj.status as string) || (rawObj.order_status as string) || "",
  buyer: { name: (rawObj.buyer_name as string) || (rawObj.customerName as string), phone: (rawObj.buyer_phone as string) || (rawObj.customerPhone as string) },
    orderedAt: (rawObj.createdAt as string) || (rawObj.ordered_at as string) || new Date().toISOString(),
    items,
  };
}

export function normalizeFromKilimall(raw: unknown, shopId: string): NormalizedOrder {
  // Minimal mapping for Kilimall; expand as needed to match Kilimall response structure.
  const rawObj = (raw || {}) as Record<string, unknown>;
  const itemsArr = (rawObj.items || rawObj.order_items || []) as unknown[];
  const items = itemsArr.map((it: unknown) => {
    const obj = (it || {}) as Record<string, unknown>;
    return {
      externalSku: (obj.sku as string) || (obj.spu as string) || String(obj.product_sku || ""),
      title: (obj.title as string) || (obj.name as string) || "",
      qty: Number(obj.quantity ?? obj.qty ?? 1),
      salePrice: Number(obj.price ?? obj.price_total ?? 0),
      fees: {
        commission: Number(obj.commission ?? 0),
        shipping: Number(obj.shipping ?? 0),
        tax: Number(obj.tax ?? 0),
      },
    };
  });

  return {
    platform: 'KILIMALL',
    shopId,
    externalOrderId: String(rawObj.order_id || rawObj.externalOrderId || rawObj.trade_no || rawObj.order_no),
    status: (rawObj.status as string) || (rawObj.order_status as string) || "",
  buyer: { name: ((rawObj.buyer as Record<string, unknown>)?.name as string) || (rawObj.customerName as string), phone: ((rawObj.buyer as Record<string, unknown>)?.phone as string) || (rawObj.customerPhone as string) },
    orderedAt: (rawObj.created_at as string) || (rawObj.ordered_at as string) || new Date().toISOString(),
    items,
  };
}
