import { jnum, jstr, jn } from "@/lib/jsonGet";

export function extractReceiptTotalKES(receipt: { totals: any }): number {
  const totals = receipt?.totals;
  return (
    jnum(totals, "sellingTotal") ||
    jnum(totals, "grandTotal") ||
    jnum(totals, "total") ||
    jnum(totals, "amount") ||
    jnum(totals, "subtotal") ||
    0
  );
}

export function extractItemsShort(receipt: { data: any }, maxItems = 5): string {
  const data = receipt?.data;
  const items =
    (Array.isArray(jn(data, "items")) && jn(data, "items")) ||
    (Array.isArray(jn(data, "lineItems")) && jn(data, "lineItems")) ||
    (Array.isArray(jn(data, "lines")) && jn(data, "lines")) ||
    [];

  if (!Array.isArray(items) || items.length === 0) return "";

  const parts = items.slice(0, maxItems).map((item: any, index: number) => {
    const name =
      jstr(item, "name") ||
      jstr(item, "title") ||
      jstr(item, "item") ||
      jstr(item, "description") ||
      "Item";
    const qty = Number(item?.qty ?? item?.quantity ?? 1);
    const safeQty = Number.isFinite(qty) ? qty : 1;
    return `${index + 1}) ${name} x${safeQty}`;
  });

  const more = items.length > maxItems ? ` (+${items.length - maxItems} more)` : "";
  return parts.join(", ") + more;
}
