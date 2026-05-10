"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { OrdersRow } from "../_lib/types";

type Props = {
  rows: OrdersRow[];
  nextToken: string | null;
  isLastPage: boolean;
};

type Money = { currency?: string; value: number };

type OrderItemDetail = {
  id: string;
  productName: string;
  sellerSku?: string;
  quantity?: number;
  imageUrl?: string;
  shopName?: string;
  shipmentMethod?: string;
  shippingInformation?: string;
  recipientName?: string;
  recipientAddress?: string;
  recipientPhone?: string;
  total?: Money;
  productUrl?: string;
};

type OrderDetails = {
  url?: string;
  name?: string;
  total?: Money;
  count?: number;
  paymentMethod?: string;
  shipmentMethod?: string;
  recipientName?: string;
  recipientAddress?: string;
  recipientPhone?: string;
  items: OrderItemDetail[];
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function readNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value.replace(/[, ]+/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function readMoney(input: unknown): Money | undefined {
  const obj = toRecord(input);
  if (obj) {
    const value = readNumber(
      obj.value,
      obj.amount,
      obj.total,
      obj.price,
      obj.paid,
      obj.subtotal,
    );
    if (value === undefined) return undefined;
    return {
      currency: readString(obj.currency, obj.currencyCode, obj.currency_code),
      value,
    };
  }
  const value = readNumber(input);
  return value === undefined ? undefined : { value };
}

function pickNestedString(
  sources: Array<Record<string, unknown> | null>,
  paths: string[][],
): string | undefined {
  for (const source of sources) {
    if (!source) continue;
    for (const path of paths) {
      let current: unknown = source;
      let failed = false;
      for (const key of path) {
        const record = toRecord(current);
        if (!record || !(key in record)) {
          failed = true;
          break;
        }
        current = record[key];
      }
      if (!failed) {
        const resolved = readString(current);
        if (resolved) return resolved;
      }
    }
  }
  return undefined;
}

function joinAddress(parts: Array<string | undefined>): string | undefined {
  const filtered = parts.map((part) => part?.trim()).filter(Boolean) as string[];
  return filtered.length ? filtered.join(", ") : undefined;
}

function parseItem(item: Record<string, unknown>): OrderItemDetail {
  const product = toRecord(item.product);
  const receiver = toRecord(item.receiver);
  const customer = toRecord(item.customer);
  const address = toRecord(item.address);
  const shippingAddress = toRecord(item.shippingAddress);
  const pickupStation = toRecord(item.pickupStation);
  const shipping = toRecord(item.shipping);
  const shipment = toRecord(item.shipment);
  const delivery = toRecord(item.delivery);
  const store = toRecord(item.store);
  const shop = toRecord(item.shop);

  const recipientName = pickNestedString(
    [item, receiver, customer, address, shippingAddress, shipping, shipment, delivery, pickupStation],
    [
      ["customerName"],
      ["recipientName"],
      ["fullName"],
      ["name"],
      ["receiverName"],
      ["firstName"],
    ],
  );

  const recipientPhone = pickNestedString(
    [item, receiver, customer, address, shippingAddress, shipping, shipment, delivery, pickupStation],
    [
      ["customerPhone"],
      ["phone"],
      ["phoneNumber"],
      ["mobile"],
      ["recipientPhone"],
      ["phoneNo"],
    ],
  );

  const recipientAddress = joinAddress([
    pickNestedString([item, address, shippingAddress, shipping, shipment, delivery, pickupStation], [["address1"], ["line1"], ["street"], ["address"], ["addressLine1"], ["stationName"]]),
    pickNestedString([item, address, shippingAddress, shipping, shipment, delivery, pickupStation], [["address2"], ["line2"], ["addressLine2"]]),
    pickNestedString([item, address, shippingAddress, shipping, shipment, delivery, pickupStation], [["city"], ["town"]]),
    pickNestedString([item, address, shippingAddress, shipping, shipment, delivery, pickupStation], [["state"], ["county"], ["region"]]),
    pickNestedString([item, address, shippingAddress, shipping, shipment, delivery, pickupStation], [["country"], ["countryName"]]),
  ]);

  const shippingInformation = joinAddress([
    pickNestedString([item, shipping, shipment, delivery, pickupStation], [["shipmentMethod"], ["shippingMethod"], ["type"], ["mode"], ["shippingType"], ["method"]]),
    pickNestedString([item, shipping, shipment, delivery, pickupStation], [["provider"], ["carrier"], ["providerName"]]),
    pickNestedString([item, shipping, shipment, delivery, pickupStation], [["station"], ["stationName"], ["pickupStation"], ["name"]]),
  ]);

  const money =
    readMoney(item.totalAmountLocal) ??
    readMoney(item.totalPriceLocal) ??
    readMoney(item.subtotalLocal) ??
    readMoney(item.paidPriceLocal) ??
    readMoney(item.itemPriceLocal) ??
    readMoney(item.paidPrice) ??
    readMoney(item.itemPrice) ??
    readMoney(product?.priceLocal) ??
    readMoney(product?.price);

  return {
    id: readString(item.id, item.orderItemId, item.skuId, item.productId) ?? Math.random().toString(36).slice(2),
    productName:
      readString(
        product?.name,
        item.productName,
        item.name,
        item.title,
        item.details,
      ) ?? "Item",
    sellerSku: readString(item.sellerSku, item.sku, item.shopSku, product?.sellerSku, product?.sku, item.sellerSKU),
    quantity: readNumber(item.quantity, item.qty),
    imageUrl: readString(
      item.imageUrl,
      item.image,
      product?.image,
      product?.imageUrl,
      product?.thumbnail,
    ),
    shopName: readString(item.shopName, product?.shopName, store?.name, shop?.name, item.shop),
    shipmentMethod: readString(
      item.shipmentMethod,
      item.shippingMethod,
      shipping?.method,
      shipment?.method,
      delivery?.method,
    ),
    shippingInformation,
    recipientName,
    recipientAddress,
    recipientPhone,
    total: money,
    productUrl: readString(
      item.productUrl,
      item.url,
      item.link,
      product?.url,
      product?.productUrl,
      product?.shareUrl,
    ),
  };
}

function parseDetailsResponse(payload: any): OrderDetails {
  const itemsRaw = Array.isArray(payload?.items) ? payload.items : [];
  const items = itemsRaw
    .map((item) => (toRecord(item) ? parseItem(item as Record<string, unknown>) : null))
    .filter((item): item is OrderItemDetail => Boolean(item));
  const first = items[0];

  return {
    url: readString(payload?.primaryProductUrl),
    name: readString(payload?.primaryProductName, first?.productName),
    total: readMoney(payload?.totalAmountLocal),
    count:
      typeof payload?.itemsCount === "number"
        ? payload.itemsCount
        : items.length || undefined,
    paymentMethod: readString(
      payload?.paymentMethod,
      payload?.payment_method,
      payload?.isPrepayment ? "Prepaid" : undefined,
    ),
    shipmentMethod: readString(
      payload?.shipmentMethod,
      payload?.shippingMethod,
      first?.shipmentMethod,
      first?.shippingInformation,
    ),
    recipientName: first?.recipientName,
    recipientAddress: first?.recipientAddress,
    recipientPhone: first?.recipientPhone,
    items,
  };
}

function formatMoney(money?: Money): string {
  if (!money) return "-";
  return `${money.currency ?? ""} ${money.value.toLocaleString()}`.trim();
}

function formatDateTime(value?: string): string {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function DetailsPanel({
  row,
  details,
  loading,
  error,
  onPrint,
  printBusy,
}: {
  row: OrdersRow;
  details?: OrderDetails;
  loading: boolean;
  error?: string;
  onPrint: () => void;
  printBusy: boolean;
}) {
  const items = details?.items ?? [];
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-4 md:p-5">
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Send To</p>
          <div className="space-y-1 text-sm text-slate-200">
            <div className="font-medium text-white">
              {details?.recipientName ?? (loading ? "Loading recipient..." : error ? "Recipient unavailable" : "No recipient available")}
            </div>
            <div>{details?.recipientAddress ?? (loading ? "Fetching address..." : error ? "Could not load address." : "No address available")}</div>
            {details?.recipientPhone && <div>{details.recipientPhone}</div>}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Order Summary</p>
          <div className="space-y-1 text-sm text-slate-200">
            <div>Payment: {details?.paymentMethod ?? (row.isPrepayment ? "Prepaid" : "-")}</div>
            <div>Shipment: {details?.shipmentMethod ?? "-"}</div>
            <div>Items: {details?.count ?? row.totalItems ?? "-"}</div>
            <div>Total: {formatMoney(details?.total ?? row.totalAmountLocal)}</div>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Actions</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:opacity-60"
              onClick={onPrint}
              disabled={printBusy}
            >
              {printBusy ? "Printing..." : "Print / RTS"}
            </button>
            {details?.url && (
              <a
                href={details.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
              >
                Open Product
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="pb-3 pr-4">Seller SKU</th>
              <th className="pb-3 pr-4">Product</th>
              <th className="pb-3 pr-4">Shop</th>
              <th className="pb-3 pr-4">Shipping Information</th>
              <th className="pb-3 pr-4">Qty</th>
              <th className="pb-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-5 text-slate-400">
                  Loading order details...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="py-5 text-amber-300">
                  {error}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-5 text-slate-400">
                  No item details available for this order yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-white/5 align-top">
                  <td className="py-4 pr-4 text-slate-300">{item.sellerSku ?? "-"}</td>
                  <td className="py-4 pr-4">
                    <div className="flex items-start gap-3">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          className="h-12 w-12 rounded-lg border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-white/10 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                          Img
                        </div>
                      )}
                      <div className="min-w-0">
                        {item.productUrl ? (
                          <a
                            href={item.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="line-clamp-2 text-slate-100 hover:text-amber-300 hover:underline"
                          >
                            {item.productName}
                          </a>
                        ) : (
                          <div className="line-clamp-2 text-slate-100">{item.productName}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 pr-4 text-slate-300">{item.shopName ?? row.shopName ?? "-"}</td>
                  <td className="py-4 pr-4 text-slate-300">
                    {item.shippingInformation ?? item.shipmentMethod ?? details?.shipmentMethod ?? "-"}
                  </td>
                  <td className="py-4 pr-4 text-slate-300">{item.quantity ?? "-"}</td>
                  <td className="py-4 text-slate-100">{formatMoney(item.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OrdersTable({ rows, nextToken, isLastPage }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<"pack" | "rts" | "print" | null>(null);
  const [selected, setSelected] = useState<Record<string, { shopId?: string }>>({});
  const [details, setDetails] = useState<Record<string, OrderDetails>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});
  const [detailsError, setDetailsError] = useState<Record<string, string>>({});
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();

  const dispatchRefresh = () => {
    try {
      window.dispatchEvent(new CustomEvent("orders:refresh", { detail: { source: "action", ts: Date.now() } }));
    } catch {
      // ignored
    }
  };

  async function callAction(row: OrdersRow, action: "pack" | "rts" | "print") {
    const id = row.id;
    const key = `${id}:${action}`;
    setBusy(key);
    try {
      const shopIdForRow =
        row.shopId ??
        (Array.isArray(row.shopIds) ? row.shopIds.find((s) => typeof s === "string") : undefined) ??
        undefined;
      if (action === "print") {
        const rtsEndpoint = shopIdForRow
          ? `/api/jumia/orders/${id}/ready-to-ship?shopId=${encodeURIComponent(shopIdForRow)}`
          : `/api/jumia/orders/${id}/ready-to-ship`;
        const res = await fetch(rtsEndpoint, { method: "POST" });
        if (!res.ok) throw new Error(`Action rts failed with status ${res.status}`);
        const printUrl = shopIdForRow
          ? `/api/jumia/orders/${id}/print-labels?shopId=${encodeURIComponent(shopIdForRow)}`
          : `/api/jumia/orders/${id}/print-labels`;
        try {
          window.open(printUrl, "_blank");
        } catch {}
        const params = new URLSearchParams();
        if (shopIdForRow) params.set("shopId", shopIdForRow);
        const query = params.toString();
        await fetch(`/api/jumia/jobs/sync-incremental${query ? `?${query}` : ""}`, { method: "POST" }).catch(() => {});
        dispatchRefresh();
        router.refresh();
        return;
      }

      const endpoint =
        action === "pack"
          ? shopIdForRow
            ? `/api/jumia/orders/${id}/pack?shopId=${encodeURIComponent(shopIdForRow)}`
            : `/api/jumia/orders/${id}/pack`
          : shopIdForRow
            ? `/api/jumia/orders/${id}/ready-to-ship?shopId=${encodeURIComponent(shopIdForRow)}`
            : `/api/jumia/orders/${id}/ready-to-ship`;
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        throw new Error(`Action ${action} failed with status ${res.status}`);
      }

      if (action === "rts") {
        const printUrl = shopIdForRow
          ? `/api/jumia/orders/${id}/print-labels?shopId=${encodeURIComponent(shopIdForRow)}`
          : `/api/jumia/orders/${id}/print-labels`;
        try {
          window.open(printUrl, "_blank");
        } catch {}
      }

      try {
        const params = new URLSearchParams();
        if (shopIdForRow) params.set("shopId", shopIdForRow);
        const query = params.toString();
        await fetch(`/api/jumia/jobs/sync-incremental${query ? `?${query}` : ""}`, { method: "POST" });
      } catch (err) {
        console.warn("[orders.table] incremental sync failed", err);
      }

      dispatchRefresh();
      router.refresh();
    } catch (error) {
      console.warn("[orders.table] action failed", error);
    } finally {
      setBusy(null);
    }
  }

  function pageNext() {
    if (!nextToken) return;
    const q = new URLSearchParams(sp?.toString() || "");
    q.set("nextToken", nextToken);
    const target = q.toString() ? `${pathname ?? "/"}?${q.toString()}` : (pathname ?? "/");
    router.push(target);
  }

  function pagePrev() {
    const q = new URLSearchParams(sp?.toString() || "");
    q.delete("nextToken");
    const target = q.toString() ? `${pathname ?? "/"}?${q.toString()}` : (pathname ?? "/");
    router.push(target);
  }

  async function ensureDetails(row: OrdersRow) {
    const id = row.id;
    if (details[id] || loadingDetails[id]) return;
    const shopId = row.shopId || (Array.isArray(row.shopIds) ? row.shopIds[0] : undefined);
    setLoadingDetails((prev) => ({ ...prev, [id]: true }));
    setDetailsError((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const url = shopId
        ? `/api/jumia/orders/${encodeURIComponent(id)}/items?shopId=${encodeURIComponent(shopId)}`
        : `/api/jumia/orders/${encodeURIComponent(id)}/items`;
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error
            : `Failed to load order details (${res.status})`,
        );
      }
      if ((!Array.isArray(payload?.items) || payload.items.length === 0) && typeof payload?.error === "string" && payload.error.trim()) {
        throw new Error(payload.error.trim());
      }
      setDetails((prev) => ({ ...prev, [id]: parseDetailsResponse(payload) }));
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "Loading order details timed out."
          : error instanceof Error && error.message
            ? error.message
            : "Failed to load order details.";
      setDetailsError((prev) => ({ ...prev, [id]: message }));
    } finally {
      window.clearTimeout(timeout);
      setLoadingDetails((prev) => ({ ...prev, [id]: false }));
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ordersSelection");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") setSelected(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("ordersSelection", JSON.stringify(selected));
    } catch {}
  }, [selected]);

  const currentShopId = useMemo(() => sp?.get("shopId") || undefined, [sp]);
  const selectedIds = Object.keys(selected);
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected[r.id]);
  const someSelected = selectedIds.length > 0;

  function toggleRow(id: string, shopId?: string) {
    setSelected((prev) => {
      const cp = { ...prev };
      if (cp[id]) delete cp[id];
      else cp[id] = { shopId };
      return cp;
    });
  }

  function toggleExpand(row: OrdersRow) {
    const willExpand = !expanded[row.id];
    setExpanded((prev) => ({ ...prev, [row.id]: willExpand }));
    if (willExpand) void ensureDetails(row);
  }

  function toggleAllOnPage() {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const cp = { ...prev } as Record<string, { shopId?: string }>;
        for (const id of rows.map((r) => r.id)) delete cp[id];
        return cp;
      });
    } else {
      const add: Record<string, { shopId?: string }> = {};
      for (const r of rows) add[r.id] = { shopId: r.shopId || (Array.isArray(r.shopIds) ? r.shopIds[0] : undefined) };
      setSelected((prev) => ({ ...prev, ...add }));
    }
  }

  function timeAgo(ts?: string) {
    if (!ts) return "";
    try {
      const d = new Date(ts);
      const now = Date.now();
      const diff = Math.max(0, now - d.getTime());
      const s = Math.floor(diff / 1000);
      if (s < 60) return `${s}s ago`;
      const m = Math.floor(s / 60);
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h ago`;
      const dys = Math.floor(h / 24);
      return `${dys}d ago`;
    } catch {
      return "";
    }
  }

  async function runBulk(action: "pack" | "rts" | "print") {
    if (!someSelected) return;
    setBulkBusy(action);
    try {
      const groups = new Map<string, string[]>();
      for (const [id, meta] of Object.entries(selected)) {
        const sid = meta.shopId || currentShopId || "";
        if (!sid) continue;
        if (!groups.has(sid)) groups.set(sid, []);
        groups.get(sid)!.push(id);
      }
      for (const [shopId, orderIds] of groups) {
        if (!orderIds.length) continue;
        if (action === "print") {
          await fetch("/api/jumia/orders/bulk/ready-to-ship", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shopId, orderIds }),
          });
          await fetch("/api/jumia/orders/bulk/print-labels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shopId, orderIds }),
          });
        } else {
          const endpoint = action === "pack" ? "/api/jumia/orders/bulk/pack" : "/api/jumia/orders/bulk/ready-to-ship";
          await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shopId, orderIds }),
          });
        }
        await fetch(`/api/jumia/jobs/sync-incremental?shopId=${encodeURIComponent(shopId)}`, { method: "POST" }).catch(() => {});
      }
      setSelected({});
      dispatchRefresh();
      router.refresh();
    } catch (e) {
      console.warn("[orders.table] bulk action failed", e);
    } finally {
      setBulkBusy(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(8,13,23,0.98))] shadow-[0_22px_60px_rgba(0,0,0,0.28)]">
      {someSelected && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-black/20 p-3">
          <div className="text-sm">Selected {selectedIds.length} row(s)</div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-white/10 px-3 py-1 hover:bg-white/10 disabled:opacity-50"
              onClick={() => runBulk("pack")}
              disabled={!!bulkBusy}
            >
              {bulkBusy === "pack" ? "Packing..." : "Pack selected"}
            </button>
            <button
              className="rounded-xl border border-white/10 px-3 py-1 hover:bg-white/10 disabled:opacity-50"
              onClick={() => runBulk("rts")}
              disabled={!!bulkBusy}
            >
              {bulkBusy === "rts" ? "Marking..." : "RTS selected"}
            </button>
            <button
              className="rounded-xl border border-white/10 px-3 py-1 hover:bg-white/10 disabled:opacity-50"
              onClick={() => runBulk("print")}
              disabled={!!bulkBusy}
            >
              {bulkBusy === "print" ? "Printing..." : "Print selected"}
            </button>
            <button
              className="rounded-xl border border-white/10 px-3 py-1 hover:bg-white/10"
              onClick={() => setSelected({})}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto p-4 md:p-5">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="w-10 px-2 py-3"></th>
              <th className="w-10 px-2 py-3">
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} />
              </th>
              <th className="px-3 py-3">Order Number</th>
              <th className="px-3 py-3">Order Date</th>
              <th className="px-3 py-3">Pending Since</th>
              <th className="px-3 py-3">Payment Method</th>
              <th className="px-3 py-3">Price</th>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">Packed Items</th>
              <th className="px-3 py-3">Shipment Method</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-slate-400">
                  No orders found.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const rowDetails = details[row.id];
              const expandedRow = !!expanded[row.id];
              const actionBusy = busy === `${row.id}:pack` || busy === `${row.id}:rts`;
              const printBusy = busy === `${row.id}:print`;
              return (
                <>
                  <tr key={row.id} className="border-b border-white/5 align-top">
                    <td className="px-2 py-4">
                      <button
                        type="button"
                        onClick={() => toggleExpand(row)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/5 text-sm text-slate-100 transition hover:bg-white/10"
                        aria-label={expandedRow ? "Collapse order details" : "Expand order details"}
                      >
                        {expandedRow ? "-" : "+"}
                      </button>
                    </td>
                    <td className="px-2 py-4">
                      <input
                        type="checkbox"
                        checked={!!selected[row.id]}
                        onChange={() => toggleRow(row.id, row.shopId || (Array.isArray(row.shopIds) ? row.shopIds[0] : undefined))}
                      />
                    </td>
                    <td className="px-3 py-4">
                      <div className="font-medium text-cyan-300">{row.number ?? row.id}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.status ?? "-"}</div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-slate-100">{formatDateTime(row.createdAt)}</div>
                      {row.updatedAt && (
                        <div className="mt-1 text-xs text-slate-500">
                          Updated {timeAgo(row.updatedAt)} • {formatDateTime(row.updatedAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      {row.pendingSince ? (
                        <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
                          {row.pendingSince}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      {rowDetails?.paymentMethod ?? (row.isPrepayment ? "Prepaid" : "-")}
                    </td>
                    <td className="px-3 py-4 font-medium text-slate-100">
                      {formatMoney(row.totalAmountLocal ?? rowDetails?.total)}
                    </td>
                    <td className="px-3 py-4">{rowDetails?.count ?? row.totalItems ?? "-"}</td>
                    <td className="px-3 py-4">
                      {typeof row.packedItems === "number" && typeof row.totalItems === "number"
                        ? `${row.packedItems}/${row.totalItems}`
                        : row.packedItems ?? "-"}
                    </td>
                    <td className="px-3 py-4">
                      <div>{rowDetails?.shipmentMethod ?? "-"}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.shopName ?? row.shopId ?? row.shopIds?.[0] ?? "-"}</div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex gap-2">
                        <button
                          className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:opacity-60"
                          onClick={() => callAction(row, "print")}
                          disabled={printBusy || actionBusy}
                        >
                          {printBusy ? "..." : "Print"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedRow && (
                    <tr key={`${row.id}:details`} className="border-b border-white/5">
                      <td colSpan={11} className="px-3 pb-5 pt-3">
                        <DetailsPanel
                          row={row}
                          details={rowDetails}
                          loading={!!loadingDetails[row.id]}
                          error={detailsError[row.id]}
                          onPrint={() => callAction(row, "print")}
                          printBusy={printBusy}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-4 py-4 md:px-5">
        <button onClick={pagePrev} className="rounded-xl border border-white/10 px-3 py-1 hover:bg-white/10">
          First page
        </button>
        <div className="text-xs opacity-70">
          {isLastPage ? "Last page" : nextToken ? "More results available" : ""}
        </div>
        <button
          onClick={pageNext}
          disabled={!nextToken}
          className="rounded-xl border border-white/10 px-3 py-1 hover:bg-white/10 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
