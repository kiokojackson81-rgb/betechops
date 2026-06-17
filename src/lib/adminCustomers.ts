import { WebsiteOrderStatus } from "@prisma/client";
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

function buildFallbackCustomerId(prefix: string, recordId: string) {
  return `${prefix}-${recordId}`;
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

function moneyLabel(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function buildGroupId(args: {
  userId?: string | null;
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  fallbackPrefix: string;
  fallbackId: string;
  phoneToGroup: Map<string, string>;
  emailToGroup: Map<string, string>;
  nameToGroup: Map<string, string>;
}) {
  const normalizedPhone = normalizePhone(args.phone ?? undefined);
  const normalizedEmail = normalizeEmail(args.email);
  const normalizedName = normalizeName(args.name);
  const fallbackId =
    args.userId ||
    normalizedPhone ||
    normalizedEmail ||
    normalizedName ||
    buildFallbackCustomerId(args.fallbackPrefix, args.fallbackId);

  const groupId =
    args.userId ||
    (normalizedPhone ? args.phoneToGroup.get(normalizedPhone) : undefined) ||
    (normalizedEmail ? args.emailToGroup.get(normalizedEmail) : undefined) ||
    (normalizedName ? args.nameToGroup.get(normalizedName) : undefined) ||
    fallbackId;

  return { groupId, normalizedPhone, normalizedEmail, normalizedName };
}

function applyGroupIdentity(
  group: CustomerGroup,
  identity: {
    normalizedPhone: string;
    normalizedEmail: string;
    normalizedName: string;
    phoneToGroup: Map<string, string>;
    emailToGroup: Map<string, string>;
    nameToGroup: Map<string, string>;
  },
) {
  if (identity.normalizedPhone) {
    group._phones.add(identity.normalizedPhone);
    identity.phoneToGroup.set(identity.normalizedPhone, group.id);
  }
  if (identity.normalizedEmail) {
    group._emails.add(identity.normalizedEmail);
    identity.emailToGroup.set(identity.normalizedEmail, group.id);
  }
  if (identity.normalizedName) {
    identity.nameToGroup.set(identity.normalizedName, group.id);
  }
}

function pushOrderIntoGroup(group: CustomerGroup, orderDetail: CustomerOrderDetail) {
  group.orders.push(orderDetail);
  group.totalOrders += 1;
  if (orderDetail.receiptNumber) group.totalReceipts += 1;
  group.totalSpend += orderDetail.totalAmount;
  group.totalPaid += orderDetail.paidAmount;
  group.outstandingBalance += Math.max(0, orderDetail.totalAmount - orderDetail.paidAmount);

  if (!group.firstPurchaseAt || orderDetail.createdAt < group.firstPurchaseAt) {
    group.firstPurchaseAt = orderDetail.createdAt;
  }
  if (!group.lastPurchaseAt || orderDetail.createdAt > group.lastPurchaseAt) {
    group.lastPurchaseAt = orderDetail.createdAt;
    group.lastShopName = orderDetail.shopName ?? group.lastShopName;
  }

  if (orderDetail.shopName) group._shops.add(orderDetail.shopName);
  if (orderDetail.attendantName) group._attendants.add(orderDetail.attendantName);
  if (orderDetail.attendantEmail) group._attendants.add(orderDetail.attendantEmail);

  const paymentLine = `${String(orderDetail.paymentStatus).toLowerCase()} ${moneyLabel(orderDetail.totalAmount)}`;
  group._activitySet.add(`${String(orderDetail.status).toLowerCase()} order · ${paymentLine}`);

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

export async function getAdminCustomersData(q = "", sort = "recent"): Promise<AdminCustomerRow[]> {
  const query = q.trim();
  const websiteOrders = await prisma.websiteOrder.findMany({
    where: {
      AND: [
        {
          OR: [
            { customerName: { not: "" } },
            { customerPhone: { not: "" } },
            { customerEmail: { not: null } },
          ],
        },
        query
          ? {
              OR: [
                { customerName: { contains: query, mode: "insensitive" } },
                { customerPhone: { contains: query, mode: "insensitive" } },
                { customerEmail: { contains: query, mode: "insensitive" } },
                { customerLocation: { contains: query, mode: "insensitive" } },
                { orderRef: { contains: query, mode: "insensitive" } },
                { deliveryMethod: { contains: query, mode: "insensitive" } },
                { paymentMethod: { contains: query, mode: "insensitive" } },
                { items: { some: { productName: { contains: query, mode: "insensitive" } } } },
              ],
            }
          : {},
      ],
    },
    include: {
      items: true,
      receipt: {
        select: {
          receiptNumber: true,
          generatedAt: true,
        },
      },
      confirmedBy: {
        select: {
          name: true,
          email: true,
        },
      },
      customerUser: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const agentSales = await prisma.agentSale.findMany({
    where: {
      receiptId: null,
      AND: [
        {
          OR: [
            { customerName: { not: "" } },
            { customerPhone: { not: "" } },
          ],
        },
        query
          ? {
              OR: [
                { customerName: { contains: query, mode: "insensitive" } },
                { customerPhone: { contains: query, mode: "insensitive" } },
                { customerLocation: { contains: query, mode: "insensitive" } },
                { productName: { contains: query, mode: "insensitive" } },
                { productCategory: { contains: query, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    include: {
      agent: {
        select: {
          name: true,
          email: true,
        },
      },
      customerUser: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const groups = new Map<string, CustomerGroup>();
  const phoneToGroup = new Map<string, string>();
  const emailToGroup = new Map<string, string>();
  const nameToGroup = new Map<string, string>();

  for (const order of websiteOrders) {
    const identity = buildGroupId({
      userId: order.customerUserId || order.customerUser?.id || null,
      phone: order.customerPhone || order.customerUser?.phone || null,
      email: order.customerEmail || order.customerUser?.email || null,
      name: order.customerName || order.customerUser?.name || null,
      fallbackPrefix: "website-order",
      fallbackId: order.id,
      phoneToGroup,
      emailToGroup,
      nameToGroup,
    });

    let group = groups.get(identity.groupId);
    if (!group) {
      group = makeGroup(identity.groupId, order.customerName.trim() || order.customerUser?.name || "Unnamed customer");
      groups.set(identity.groupId, group);
    }

    applyGroupIdentity(group, {
      ...identity,
      phoneToGroup,
      emailToGroup,
      nameToGroup,
    });

    if (!group.displayName || group.displayName === "Unnamed customer") {
      group.displayName = order.customerName.trim() || order.customerUser?.name || group.displayName;
    }

    const paidAmount =
      order.status === WebsiteOrderStatus.CANCELLED
        ? 0
        : Number(order.total ?? 0);

    const orderDetail: CustomerOrderDetail = {
      id: order.id,
      orderNumber: order.orderRef,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      totalAmount: Number(order.total ?? 0),
      paidAmount,
      paymentStatus: order.paymentMethod,
      status: order.status,
      createdAt: order.createdAt,
      shopName:
        order.source === "POS"
          ? "POS Receipts"
          : order.source === "WEBSITE"
            ? "Website Orders"
            : order.source || "Website Orders",
      attendantName: order.confirmedBy?.name ?? null,
      attendantEmail: order.confirmedBy?.email ?? null,
      receiptNumber: order.receipt?.receiptNumber ?? null,
      receiptGeneratedAt: order.receipt?.generatedAt ?? null,
      items: order.items.map((item) => ({
        productName: item.productName,
        sku: item.sku ?? null,
        category: item.category ?? null,
        quantity: Number(item.quantity ?? 0),
        sellingPrice: Number(item.unitPrice ?? 0),
        lineTotal: Number(item.total ?? 0),
      })),
    };

    pushOrderIntoGroup(group, orderDetail);
  }

  for (const sale of agentSales) {
    const identity = buildGroupId({
      userId: sale.customerUserId || sale.customerUser?.id || null,
      phone: sale.customerPhone || sale.customerUser?.phone || null,
      email: sale.customerUser?.email || null,
      name: sale.customerName || sale.customerUser?.name || null,
      fallbackPrefix: "agent-sale",
      fallbackId: sale.id,
      phoneToGroup,
      emailToGroup,
      nameToGroup,
    });

    let group = groups.get(identity.groupId);
    if (!group) {
      group = makeGroup(identity.groupId, sale.customerName.trim() || sale.customerUser?.name || "Unnamed customer");
      groups.set(identity.groupId, group);
    }

    applyGroupIdentity(group, {
      ...identity,
      phoneToGroup,
      emailToGroup,
      nameToGroup,
    });

    if (!group.displayName || group.displayName === "Unnamed customer") {
      group.displayName = sale.customerName.trim() || sale.customerUser?.name || group.displayName;
    }

    const orderDetail: CustomerOrderDetail = {
      id: sale.id,
      orderNumber: sale.receiptNumber || `AGENT-${sale.id.slice(0, 8).toUpperCase()}`,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      customerEmail: sale.customerUser?.email ?? null,
      totalAmount: Number(sale.totalAmount ?? 0),
      paidAmount: Number(sale.amountPaid ?? 0),
      paymentStatus: sale.paymentType,
      status: sale.status,
      createdAt: sale.createdAt,
      shopName: "Agent Orders",
      attendantName: sale.agent?.name ?? null,
      attendantEmail: sale.agent?.email ?? null,
      receiptNumber: sale.receiptNumber ?? null,
      receiptGeneratedAt: null,
      items: [
        {
          productName: sale.productName,
          sku: null,
          category: sale.productCategory ?? null,
          quantity: Number(sale.quantity ?? 0),
          sellingPrice: Number(sale.unitPrice ?? 0),
          lineTotal: Number(sale.totalAmount ?? 0),
        },
      ],
    };

    pushOrderIntoGroup(group, orderDetail);
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
      orders: group.orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
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
