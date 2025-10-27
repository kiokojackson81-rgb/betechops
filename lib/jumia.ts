// lib/jumia.ts
import type { NextRequest } from "next/server";

type JumiaClientOpts = {
  apiBase: string;            // e.g. https://vendor-api.jumia.com
  clientId: string;           // your App Client ID
  refreshToken: string;       // Self Authorization Refresh Token
};

type TokenCache = { accessToken?: string; exp?: number };
const mem: Record<string, TokenCache> = {};

async function mintAccessToken({ apiBase, clientId, refreshToken }: JumiaClientOpts) {
  const k = `jumia:${clientId}`;
  const hit = mem[k];
  const now = Math.floor(Date.now() / 1000);
  if (hit?.accessToken && hit.exp && hit.exp - 60 > now) return hit.accessToken;

  const url = `${new URL(apiBase).origin}/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) {
    const j = await r.text();
    throw new Error(`OIDC mint token failed: ${r.status} ${j}`);
  }
  const j = await r.json() as { access_token: string; expires_in: number };
  mem[k] = { accessToken: j.access_token, exp: now + (j.expires_in ?? 12 * 3600) };
  return j.access_token;
}

export function makeJumiaFetch(opts: JumiaClientOpts) {
  return async function jumiaFetch(path: string, init: RequestInit = {}) {
    const token = await mintAccessToken(opts);
    const base = opts.apiBase.replace(/\/+$/, "");
    const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
    const r = await fetch(url, {
      ...init,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": init.body ? "application/json" : "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`Jumia ${init.method || "GET"} ${path} failed: ${r.status} ${t}`);
    }
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) return r.json();
    if (ct.includes("application/pdf") || ct.includes("octet-stream")) {
      const b = await r.arrayBuffer();
      return { _binary: Buffer.from(b).toString("base64"), contentType: ct };
    }
    const text = await r.text();
    try { return JSON.parse(text); } catch { return text; }
  };
}

export function getJumiaClient(opts: JumiaClientOpts) {
  const jf = makeJumiaFetch(opts);
  return {
    getShops: () => jf("/shops"),
    getShopsOfMaster: () => jf("/shops-of-master-shop"),
    getBrands: (page=1) => jf(`/catalog/brands?page=${page}`),
    getCategories: (page=1, attributeSetName?: string) =>
      jf(`/catalog/categories?page=${page}${attributeSetName ? `&attributeSetName=${encodeURIComponent(attributeSetName)}` : ""}`),
    getAttributeSet: (id: string) => jf(`/catalog/attribute-sets/${id}`),
    getProducts: (q: { token?: string; size?: number; sids?: string[]; categoryCode?: number; createdAtFrom?: string; createdAtTo?: string; sellerSku?: string; shopId?: string }) => {
      const p = new URLSearchParams();
      if (q.token) p.set("token", q.token);
      if (q.size) p.set("size", String(q.size));
      if (q.sids?.length) q.sids.forEach(s => p.append("sids", s));
      if (q.categoryCode) p.set("categoryCode", String(q.categoryCode));
      if (q.createdAtFrom) p.set("createdAtFrom", q.createdAtFrom);
      if (q.createdAtTo) p.set("createdAtTo", q.createdAtTo);
      if (q.sellerSku) p.set("sellerSku", q.sellerSku);
      if (q.shopId) p.set("shopId", q.shopId);
      return jf(`/catalog/products?${p.toString()}`);
    },
    getStock: (q: { token?: string; size?: number; productSids?: string[] }) => {
      const p = new URLSearchParams();
      if (q.token) p.set("token", q.token);
      if (q.size) p.set("size", String(q.size));
      if (q.productSids?.length) q.productSids.forEach(s => p.append("productSids", s));
      return jf(`/catalog/stock?${p.toString()}`);
    },
    createProducts: (payload: any) => jf("/feeds/products/create", { method: "POST", body: JSON.stringify(payload) }),
    updateProducts: (payload: any) => jf("/feeds/products/update", { method: "POST", body: JSON.stringify(payload) }),
    updatePrice: (payload: any) => jf("/feeds/products/price", { method: "POST", body: JSON.stringify(payload) }),
    updateStock: (payload: any) => jf("/feeds/products/stock", { method: "POST", body: JSON.stringify(payload) }),
    updateStatus: (payload: any) => jf("/feeds/products/status", { method: "POST", body: JSON.stringify(payload) }),
    getFeedDetail: (id: string) => jf(`/feeds/${id}`),
    getOrders: (q: Record<string,string|number|boolean|undefined>) => {
      const p = new URLSearchParams();
      for (const [k,v] of Object.entries(q)) if (v!==undefined && v!==null) p.set(k, String(v));
      return jf(`/orders?${p.toString()}`);
    },
    getOrderItems: (q: { orderId: string | string[]; status?: string; shopId?: string }) => {
      const p = new URLSearchParams();
      const ids = Array.isArray(q.orderId) ? q.orderId : [q.orderId];
      ids.forEach(id => p.append("orderId", id));
      if (q.status) p.set("status", q.status);
      if (q.shopId) p.set("shopId", q.shopId);
      return jf(`/orders/items?${p.toString()}`);
    },
    cancelItems: (orderItemIds: string[]) => jf("/orders/cancel", { method: "PUT", body: JSON.stringify({ orderItemIds }) }),
    shipmentProviders: (orderItemIds: string[]) => {
      const p = new URLSearchParams(); orderItemIds.forEach(id => p.append("orderItemId", id));
      return jf(`/orders/shipment-providers?${p.toString()}`);
    },
    pack: (payload: any) => jf("/orders/pack", { method: "POST", body: JSON.stringify(payload) }),
    packV2: (payload: any) => jf("/v2/orders/pack", { method: "POST", body: JSON.stringify(payload) }),
    readyToShip: (orderItemIds: string[]) => jf("/orders/ready-to-ship", { method: "POST", body: JSON.stringify({ orderItemIds }) }),
    printLabels: (orderItemIds: string[]) => jf("/orders/print-labels", { method: "POST", body: JSON.stringify({ orderItemIds }) }),
    consignmentCreate: (payload: any) => jf("/consignment-order", { method: "POST", body: JSON.stringify(payload) }),
    consignmentUpdate: (poNumber: string, payload: any) => jf(`/consignment-order/${encodeURIComponent(poNumber)}`, { method: "PATCH", body: JSON.stringify(payload) }),
    consignmentStock: (q: { businessClientCode: string; sku: string }) =>
      jf(`/consignment-stock?businessClientCode=${encodeURIComponent(q.businessClientCode)}&sku=${encodeURIComponent(q.sku)}`),
    payoutStatements: (q: Record<string,string|number|boolean|undefined>) => {
      const p = new URLSearchParams();
      for (const [k,v] of Object.entries(q)) if (v!==undefined && v!==null) p.set(k, String(v));
      return jf(`/payout-statement?${p.toString()}`);
    },
  };
}
