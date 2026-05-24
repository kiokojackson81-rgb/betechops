import { prisma } from "@/lib/prisma";
import { formatPhoneForDisplay, normalizePhone } from "@/lib/phone";

type CustomerOrderDetail = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  status: string;
  createdAt: Date;
  shopName: string | null;
  attendantName: string | null;
  attendantEmail: string | null;
  receiptNumber: string | null;
  receiptGeneratedAt: Date | null;
  items: Array<{
    productName: string;
    sku: string | null;
    category: string | null;
    quantity: number;
    sellingPrice: number;
    lineTotal: number;
  }>;
};

export type AdminCustomerRow = {
  id: string;
  displayName: string;
  primaryPhone: string | null;
  primaryEmail: string | null;
  phones: string[];
  emails: string[];
  totalOrders: number;
  totalReceipts: number;
  totalSpend: number;
  totalPaid: number;
  averageOrderValue: number;
  outstandingBalance: number;
  firstPurchaseAt: Date | null;
  lastPurchaseAt: Date | null;
  lastShopName: string | null;
  shops: string[];
  attendants: string[];
  recentProductNames: string[];
  activities: string[];
  orders: CustomerOrderDetail[];
  topProducts: Array<{
    name: string;
    quantity: number;
    spend: number;
    sku: string | null;
    category: string | null;
  }>;
};

type CustomerGroup = AdminCustomerRow & {
  _phones: Set<string>;
  _emails: Set<string>;
  _shops: Set<string>;
  _attendants: Set<string>;
  _productMap: Map<string, { name: string; quantity: number; spend: number; sku: string | null; category: string | null }>;
  _activitySet: Set<string>;
};

function normalizeEmail(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeName(value?: string | null) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function buildFallbackCustomerId(orderId: string) {
  return `customer-${orderId}`;
}

function makeGroup(id: string, displayName: string): CustomerGroup {
  return {
    id,
    displayName,
    primaryPhone: null,
    primaryEmail: null,
    phones: [],
    emails: [],
    totalOrders: 0,
    totalReceipts: 0,
    totalSpend: 0,
    totalPaid: 0,
    averageOrderValue: 0,
    outstandingBalance: 0,
    firstPurchaseAt: null,
    lastPurchaseAt: null,
    lastShopName: null,
    shops: [],
    attendants: [],
    recentProductNames: [],
    activities: [],
    orders: [],
    topProducts: [],
    _phones: new Set<string>(),
    _emails: new Set<string>(),
    _shops: new Set<string>(),
    _attendants: new Set<string>(),
    _productMap: new Map(),
    _activitySet: new Set(),
  };
}

export async function getAdminCustomersData(q = "", sort = "recent"): Promise<AdminCustomerRow[]> {
  const query = q.trim();
  const orders = await prisma.order.findMany({
    where: {
      AND: [
        {
          OR: [
            { customerName: { not: "" } },
            { customerPhone: { not: null } },
            { customerEmail: { not: null } },
          ],
        },
        query
          ? {
              OR: [
                { customerName: { contains: query, mode: "insensitive" } },
                { customerPhone: { contains: query, mode: "insensitive" } },
                { customerEmail: { contains: query, mode: "insensitive" } },
                { orderNumber: { contains: query, mode: "insensitive" } },
                { shop: { name: { contains: query, mode: "insensitive" } } },
                { attendant: { name: { contains: query, mode: "insensitive" } } },
                { items: { some: { product: { name: { contains: query, mode: "insensitive" } } } } },
              ],
            }
          : {},
      ],
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      totalAmount: true,
      paidAmount: true,
      paymentStatus: true,
      status: true,
      createdAt: true,
      receipt: {
        select: {
          receiptNumber: true,
          generatedAt: true,
        },
      },
      shop: {
        select: {
          name: true,
        },
      },
      attendant: {
        select: {
          name: true,
          email: true,
        },
      },
      items: {
        select: {
          quantity: true,
          sellingPrice: true,
          product: {
            select: {
              name: true,
              sku: true,
              category: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const groups = new Map<string, CustomerGroup>();
  const phoneToGroup = new Map<string, string>();
  const emailToGroup = new Map<string, string>();
  const nameToGroup = new Map<string, string>();

  for (const order of orders) {
    const normalizedPhone = normalizePhone(order.customerPhone ?? undefined);
    const normalizedEmail = normalizeEmail(order.customerEmail);
    const normalizedName = normalizeName(order.customerName);
    const fallbackId = normalizedPhone || normalizedEmail || normalizedName || buildFallbackCustomerId(order.id);
    const groupId =
      (normalizedPhone ? phoneToGroup.get(normalizedPhone) : undefined) ??
      (normalizedEmail ? emailToGroup.get(normalizedEmail) : undefined) ??
      (normalizedName ? nameToGroup.get(normalizedName) : undefined) ??
      fallbackId;

    let group = groups.get(groupId);
    if (!group) {
      group = makeGroup(groupId, order.customerName.trim() || "Unnamed customer");
      groups.set(groupId, group);
    }

    if (normalizedPhone) {
      group._phones.add(normalizedPhone);
      phoneToGroup.set(normalizedPhone, group.id);
    }
    if (normalizedEmail) {
      group._emails.add(normalizedEmail);
      emailToGroup.set(normalizedEmail, group.id);
    }
    if (normalizedName) {
      nameToGroup.set(normalizedName, group.id);
    }

    if (!group.displayName || group.displayName === "Unnamed customer") {
      group.displayName = order.customerName.trim() || group.displayName;
    }

    const orderDetail: CustomerOrderDetail = {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      totalAmount: Number(order.totalAmount ?? 0),
      paidAmount: Number(order.paidAmount ?? 0),
      paymentStatus: String(order.paymentStatus),
      status: String(order.status),
      createdAt: order.createdAt,
      shopName: order.shop?.name ?? null,
      attendantName: order.attendant?.name ?? null,
      attendantEmail: order.attendant?.email ?? null,
      receiptNumber: order.receipt?.receiptNumber ?? null,
      receiptGeneratedAt: order.receipt?.generatedAt ?? null,
      items: order.items.map((item) => ({
        productName: item.product.name,
        sku: item.product.sku ?? null,
        category: item.product.category ?? null,
        quantity: Number(item.quantity ?? 0),
        sellingPrice: Number(item.sellingPrice ?? 0),
        lineTotal: Number(item.quantity ?? 0) * Number(item.sellingPrice ?? 0),
      })),
    };

    group.orders.push(orderDetail);
    group.totalOrders += 1;
    if (order.receipt) group.totalReceipts += 1;
    group.totalSpend += Number(order.totalAmount ?? 0);
    group.totalPaid += Number(order.paidAmount ?? 0);
    group.outstandingBalance += Math.max(0, Number(order.totalAmount ?? 0) - Number(order.paidAmount ?? 0));

    if (!group.firstPurchaseAt || order.createdAt < group.firstPurchaseAt) {
      group.firstPurchaseAt = order.createdAt;
    }
    if (!group.lastPurchaseAt || order.createdAt > group.lastPurchaseAt) {
      group.lastPurchaseAt = order.createdAt;
      group.lastShopName = order.shop?.name ?? null;
    }

    if (order.shop?.name) group._shops.add(order.shop.name);
    if (order.attendant?.name) group._attendants.add(order.attendant.name);
    if (order.attendant?.email) group._attendants.add(order.attendant.email);

    const paymentLine = `${String(order.paymentStatus).toLowerCase()} ${new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(Number(order.totalAmount ?? 0))}`;
    group._activitySet.add(`${String(order.status).toLowerCase()} order · ${paymentLine}`);

    for (const item of orderDetail.items) {
      const productKey = `${item.productName.toLowerCase()}::${item.sku ?? ""}`;
      const current = group._productMap.get(productKey) ?? {
        name: item.productName,
        quantity: 0,
        spend: 0,
        sku: item.sku,
        category: item.category,
      };
      current.quantity += item.quantity;
      current.spend += item.lineTotal;
      group._productMap.set(productKey, current);
    }
  }

  const rows: AdminCustomerRow[] = Array.from(groups.values()).map((group) => {
    const phones = Array.from(group._phones).map((phone) => formatPhoneForDisplay(phone)).filter(Boolean);
    const emails = Array.from(group._emails);
    const topProducts = Array.from(group._productMap.values())
      .sort((a, b) => b.spend - a.spend || b.quantity - a.quantity)
      .slice(0, 6);

    return {
      id: group.id,
      displayName: group.displayName,
      primaryPhone: phones[0] ?? null,
      primaryEmail: emails[0] ?? null,
      phones,
      emails,
      totalOrders: group.totalOrders,
      totalReceipts: group.totalReceipts,
      totalSpend: group.totalSpend,
      totalPaid: group.totalPaid,
      averageOrderValue: group.totalOrders > 0 ? group.totalSpend / group.totalOrders : 0,
      outstandingBalance: group.outstandingBalance,
      firstPurchaseAt: group.firstPurchaseAt,
      lastPurchaseAt: group.lastPurchaseAt,
      lastShopName: group.lastShopName,
      shops: Array.from(group._shops).sort((a, b) => a.localeCompare(b)),
      attendants: Array.from(group._attendants).sort((a, b) => a.localeCompare(b)),
      recentProductNames: topProducts.slice(0, 4).map((item) => item.name),
      activities: Array.from(group._activitySet).slice(0, 4),
      orders: group.orders,
      topProducts,
    };
  });

  rows.sort((a, b) => {
    if (sort === "highest_spend") return b.totalSpend - a.totalSpend || b.totalOrders - a.totalOrders;
    if (sort === "most_orders") return b.totalOrders - a.totalOrders || b.totalSpend - a.totalSpend;
    if (sort === "alphabetical") return a.displayName.localeCompare(b.displayName);
    return (b.lastPurchaseAt?.getTime() ?? 0) - (a.lastPurchaseAt?.getTime() ?? 0);
  });

  return rows;
}
