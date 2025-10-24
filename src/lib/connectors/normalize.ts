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

export function normalizeFromJumia(raw: any, shopId: string): NormalizedOrder {
  // Minimal defensive mapping. Real mapping should be expanded to match Jumia payload.
  const items = (raw.items || raw.orderItems || []).map((it: any) => ({
    externalSku: it.sku || it.spu || String(it.product_sku || it.sku || ""),
    title: it.title || it.name || "",
    qty: Number(it.quantity || it.qty || 1),
    salePrice: Number(it.price || it.selling_price || 0),
    fees: {
      commission: Number(it.commission || it.fee || 0),
      shipping: Number(it.shipping || 0),
      tax: Number(it.tax || 0),
    },
  }));

  return {
    platform: 'JUMIA',
    shopId,
    externalOrderId: String(raw.externalId || raw.orderId || raw.order_number || raw.orderNumber),
    status: raw.status || raw.order_status || "",
    buyer: { name: raw.buyer_name || raw.customerName, phone: raw.buyer_phone || raw.customerPhone },
    orderedAt: raw.createdAt || raw.ordered_at || new Date().toISOString(),
    items,
  };
}

export function normalizeFromKilimall(raw: any, shopId: string): NormalizedOrder {
  // Minimal mapping for Kilimall; expand as needed to match Kilimall response structure.
  const items = (raw.items || raw.order_items || []).map((it: any) => ({
    externalSku: it.sku || it.spu || String(it.product_sku || ""),
    title: it.title || it.name || "",
    qty: Number(it.quantity || it.qty || 1),
    salePrice: Number(it.price || it.price_total || 0),
    fees: {
      commission: Number(it.commission || 0),
      shipping: Number(it.shipping || 0),
      tax: Number(it.tax || 0),
    },
  }));

  return {
    platform: 'KILIMALL',
    shopId,
    externalOrderId: String(raw.order_id || raw.externalOrderId || raw.trade_no || raw.order_no),
    status: raw.status || raw.order_status || "",
    buyer: { name: raw.buyer?.name || raw.customerName, phone: raw.buyer?.phone || raw.customerPhone },
    orderedAt: raw.created_at || raw.ordered_at || new Date().toISOString(),
    items,
  };
}
