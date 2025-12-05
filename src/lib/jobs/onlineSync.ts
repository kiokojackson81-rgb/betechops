"use server";

import { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const API_BASE = process.env.JUMIA_VENDOR_API_BASE ?? "https://vendor-api.jumia.com";
const DEFAULT_LOOKBACK_DAYS = 70;

type JumiaStatement = {
  statementNumber: string;
  payout?: { amount?: number };
  createdAt?: string;
  shopSid?: string;
  period?: { startDate?: string; endDate?: string };
  paid?: boolean;
};

type JumiaOrder = {
  id: string;
  number: string | number;
  createdAt: string;
  shopIds?: string[];
  status: string;
};

type JumiaOrderItem = {
  id: string;
  status: string;
  itemPriceLocal?: number;
  paidPriceLocal?: number;
  country?: { currencyCode?: string };
  product?: { name?: string; sellerSku?: string; imageUrl?: string };
};

export async function syncOnlineMarketplaceData(opts?: { lookbackDays?: number }) {
  const accessToken = await refreshJumiaToken();
  const days = opts?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const createdAfter = new Date();
  createdAfter.setDate(createdAfter.getDate() - days);

  const jumiaAccounts = await prisma.marketplaceAccount.findMany({
    where: { platform: Platform.JUMIA, isActive: true },
  });
  const accountsBySid = new Map<string, typeof jumiaAccounts[number]>();
  jumiaAccounts.forEach((account) => {
    if (account.jumiaShopSid) accountsBySid.set(account.jumiaShopSid, account);
  });

  const statements = await fetchStatements(accessToken, createdAfter);
  for (const statement of statements) {
    const account = statement.shopSid ? accountsBySid.get(statement.shopSid) : null;
    if (!account) continue;

    const { weekStart, weekEnd } = deriveWeekWindow(statement);
    const grossSales = Number(statement.payout?.amount ?? 0);
    await prisma.marketplacePayoutWeek.upsert({
      where: {
        accountId_statementNumber: {
          accountId: account.id,
          statementNumber: statement.statementNumber,
        },
      },
      create: {
        accountId: account.id,
        statementNumber: statement.statementNumber,
        weekStart,
        weekEnd,
        grossSales,
        payoutAmount: grossSales,
        currency: "KES",
        isPaid: Boolean(statement.paid),
        rawPayload: statement as unknown as Prisma.InputJsonValue,
      },
      update: {
        grossSales,
        payoutAmount: grossSales,
        isPaid: Boolean(statement.paid),
        rawPayload: statement as unknown as Prisma.InputJsonValue,
      },
    });
  }

  const orders = await fetchOrders(accessToken, createdAfter);
  for (const order of orders) {
    const shopSid = order.shopIds?.[0];
    const account = shopSid ? accountsBySid.get(shopSid) : null;
    if (!account) continue;

    const items = await fetchOrderItems(accessToken, order.id);
    for (const item of items) {
      const sellingPriceLocal = Number(item.paidPriceLocal ?? item.itemPriceLocal ?? 0);
      await prisma.marketplaceOrder.upsert({
        where: {
          id: item.id,
        },
        create: {
          id: item.id,
          accountId: account.id,
          platform: Platform.JUMIA,
          orderId: String(order.number ?? order.id),
          orderItemId: item.id,
          status: item.status,
          orderedAt: new Date(order.createdAt),
          productName: item.product?.name ?? "Unknown product",
          productUrl: item.product?.sellerSku
            ? `https://www.jumia.co.ke/${item.product.sellerSku}`
            : undefined,
          sellingPrice: sellingPriceLocal,
          currency: item.country?.currencyCode ?? "KES",
          rawPayload: item as unknown as Prisma.InputJsonValue,
        },
        update: {
          status: item.status,
          sellingPrice: sellingPriceLocal,
          currency: item.country?.currencyCode ?? "KES",
          rawPayload: item as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }
}

async function refreshJumiaToken(): Promise<string> {
  const clientId = process.env.JUMIA_CLIENT_ID;
  const refreshToken = process.env.JUMIA_REFRESH_TOKEN;
  if (!clientId || !refreshToken) {
    throw new Error("JUMIA client credentials are missing");
  }
  const res = await fetch(`${API_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to refresh Jumia token (${res.status})`);
  }
  const data = (await res.json()) as { access_token: string; refresh_token?: string };
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    // best-effort update of stored refresh token so future syncs stay valid
    process.env.JUMIA_REFRESH_TOKEN = data.refresh_token;
  }
  return data.access_token;
}

async function fetchStatements(token: string, createdAfter: Date): Promise<JumiaStatement[]> {
  const url = new URL(`${API_BASE}/payout-statement`);
  url.searchParams.set("createdAfter", createdAfter.toISOString().split("T")[0]);
  url.searchParams.set("currency", "LOCAL");
  url.searchParams.set("paid", "true");
  url.searchParams.set("size", "1000");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch payout statements (${res.status})`);
  }
  const data = (await res.json()) as { statements?: JumiaStatement[] };
  return data.statements ?? [];
}

async function fetchOrders(token: string, createdAfter: Date): Promise<JumiaOrder[]> {
  const orders: JumiaOrder[] = [];
  let nextToken: string | null = null;
  const createdBefore = new Date();

  do {
    const url = new URL(`${API_BASE}/orders`);
    url.searchParams.set("createdAfter", createdAfter.toISOString().split("T")[0]);
    url.searchParams.set("createdBefore", createdBefore.toISOString().split("T")[0]);
    url.searchParams.set("size", "200");
    if (nextToken) url.searchParams.set("token", nextToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch orders (${res.status})`);

    const data = (await res.json()) as { orders?: JumiaOrder[]; nextToken?: string | null; isLastPage?: boolean };
    if (data.orders?.length) orders.push(...data.orders);
    nextToken = data.nextToken ?? null;
    if (data.isLastPage) break;
  } while (nextToken);

  return orders;
}

async function fetchOrderItems(accessToken: string, orderId: string): Promise<JumiaOrderItem[]> {
  const url = new URL(`${API_BASE}/orders/items`);
  url.searchParams.set("orderId", orderId);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch order items (${res.status})`);
  const data = (await res.json()) as { items?: JumiaOrderItem[] };
  return data.items ?? [];
}

function deriveWeekWindow(statement: JumiaStatement) {
  const start = statement.period?.startDate ? new Date(statement.period.startDate) : statement.createdAt ? new Date(statement.createdAt) : new Date();
  const end = statement.period?.endDate
    ? new Date(statement.period.endDate)
    : new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  return { weekStart: start, weekEnd: end };
}
