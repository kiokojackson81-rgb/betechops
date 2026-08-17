import { getUnpricedDailySalesForCurrentPeriod } from "@/lib/marketingUnpricedSales";
import { prisma } from "@/lib/prisma";
import { formatNairobiDate, mondayToSundayNairobiWindow } from "@/lib/weekWindow";

export type SupervisorTodoCategory = "PRICING" | "JUMIA" | "LIPA_POLE_POLE";
export type SupervisorTodoPriority = "URGENT" | "HIGH" | "NORMAL";

export type SupervisorTodoTask = {
  key: string;
  category: SupervisorTodoCategory;
  priority: SupervisorTodoPriority;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  createdAt: string;
  contextLabel?: string;
};

export type SupervisorTodoItem = SupervisorTodoTask;

async function getPricingTasks(): Promise<SupervisorTodoTask[]> {
  const sales = (await getUnpricedDailySalesForCurrentPeriod()).filter((sale) => sale.source === "support");
  return sales.map((sale) => {
    const itemCount = Math.max(1, sale.itemsPending ?? sale.receiptItems?.length ?? 1);
    return {
      key: `pricing:pos:${sale.source}:${sale.id}`,
      category: "PRICING",
      priority: "HIGH",
      title: `${sale.receiptNumber || "POS receipt"} needs pricing`,
      description: `${itemCount} item${itemCount === 1 ? "" : "s"} from ${sale.attendantName || "the POS desk"} are waiting for buying prices before profit can be finalized.`,
      href: "/attendant/online/pos-pricing",
      actionLabel: "Open pricing queue",
      createdAt: sale.saleDate,
      contextLabel: "Pending pricing",
    } satisfies SupervisorTodoTask;
  });
}

async function getJumiaTasks(now: Date): Promise<SupervisorTodoTask[]> {
  const previousWeekReference = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { weekStart, weekEnd } = mondayToSundayNairobiWindow(previousWeekReference);
  const [accounts, shops, weeklySales, drafts] = await Promise.all([
    prisma.marketplaceAccount.findMany({
      where: { isActive: true, platform: "JUMIA" },
      select: { id: true, displayName: true, jumiaShopSid: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.shop.findMany({
      where: { isActive: true, platform: "JUMIA" },
      select: { id: true, name: true, jumiaShopSid: true, apiConfig: { select: { apiKey: true } } },
    }),
    prisma.weeklySale.findMany({
      where: { platform: "JUMIA", weekStart, weekEnd },
      select: { shopId: true },
    }),
    prisma.marketplaceStatementDraft.findMany({
      where: { platform: "JUMIA", weekStart, weekEnd },
      select: { accountId: true, shopId: true, rowCount: true, submittedByTxn: true },
    }).catch(() => []),
  ]);

  const submittedShopIds = new Set(weeklySales.map((sale) => sale.shopId).filter(Boolean));
  const completeDraftIds = new Set<string>();
  for (const draft of drafts) {
    const submittedCount =
      draft.submittedByTxn && typeof draft.submittedByTxn === "object" && !Array.isArray(draft.submittedByTxn)
        ? Object.keys(draft.submittedByTxn as Record<string, unknown>).length
        : 0;
    if (draft.rowCount > 0 && submittedCount >= draft.rowCount) {
      completeDraftIds.add(draft.accountId);
      completeDraftIds.add(draft.shopId);
    }
  }

  const normalizedShops = shops.map((shop) => ({
    ...shop,
    normalizedName: shop.name.trim().toLowerCase(),
    apiKey: String(shop.apiConfig?.apiKey ?? "").trim(),
  }));
  const weekLabel = `${formatNairobiDate(weekStart)} - ${formatNairobiDate(new Date(weekEnd.getTime() - 1))}`;

  return accounts.flatMap((account) => {
    const accountName = account.displayName.trim();
    const sid = String(account.jumiaShopSid ?? "").trim();
    const shop = normalizedShops.find((candidate) =>
      candidate.id === account.id ||
      candidate.normalizedName === accountName.toLowerCase() ||
      (sid && (candidate.jumiaShopSid === sid || candidate.apiKey === sid)),
    );
    const lookupIds = [account.id, shop?.id].filter((value): value is string => Boolean(value));
    const submitted = lookupIds.some((id) => submittedShopIds.has(id) || completeDraftIds.has(id));
    if (submitted) return [];

    return [{
      key: `jumia-week:${account.id}:${weekStart.toISOString().slice(0, 10)}`,
      category: "JUMIA" as const,
      priority: "HIGH" as const,
      title: `${accountName} weekly statement not submitted`,
      description: `The completed Jumia week ${weekLabel} has no finished statement or zero-sales submission.`,
      href: `/attendant/online/manual-weekly?weekStart=${encodeURIComponent(weekStart.toISOString().slice(0, 10))}&shopId=${encodeURIComponent(shop?.id ?? account.id)}`,
      actionLabel: "Submit weekly statement",
      createdAt: weekEnd.toISOString(),
      contextLabel: weekLabel,
    }];
  });
}

async function getLipaPolePoleTasks(): Promise<SupervisorTodoTask[]> {
  const [applications, pendingPayments, approvals] = await Promise.all([
    prisma.lipaPolePole.findMany({
      where: { status: "DRAFT" },
      select: {
        id: true,
        reference: true,
        createdAt: true,
        customer: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.lipaPolePolePayment.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        amount: true,
        reference: true,
        receivedAt: true,
        lipaPolePole: {
          select: {
            id: true,
            reference: true,
            customer: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: { receivedAt: "asc" },
      take: 50,
    }),
    prisma.lipaPolePole.findMany({
      where: { status: "AWAITING_CONVERSION" },
      select: {
        id: true,
        reference: true,
        updatedAt: true,
        customer: { select: { name: true, phone: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 25,
    }),
  ]);

  const applicationTasks = applications.map<SupervisorTodoTask>((account) => ({
    key: `lpp:application:${account.id}`,
    category: "LIPA_POLE_POLE",
    priority: "NORMAL",
    title: `New Lipa Pole Pole application: ${account.reference}`,
    description: `${account.customer.name || account.customer.phone || "Customer"} is waiting for the application and deposit details to be reviewed.`,
    href: `/attendant/online/lipa-pole-pole?id=${encodeURIComponent(account.id)}`,
    actionLabel: "Review application",
    createdAt: account.createdAt.toISOString(),
    contextLabel: "New application",
  }));
  const paymentTasks = pendingPayments.map<SupervisorTodoTask>((payment) => ({
    key: `lpp:payment:${payment.id}`,
    category: "LIPA_POLE_POLE",
    priority: "URGENT",
    title: `Payment submitted for ${payment.lipaPolePole.reference}`,
    description: `Verify KES ${Number(payment.amount).toLocaleString("en-KE")}${payment.reference ? ` (${payment.reference})` : ""} from ${payment.lipaPolePole.customer.name || payment.lipaPolePole.customer.phone || "customer"}.`,
    href: `/attendant/online/lipa-pole-pole?id=${encodeURIComponent(payment.lipaPolePole.id)}`,
    actionLabel: "Verify payment",
    createdAt: payment.receivedAt.toISOString(),
    contextLabel: "Payment verification",
  }));
  const approvalTasks = approvals.map<SupervisorTodoTask>((account) => ({
    key: `lpp:approval:${account.id}`,
    category: "LIPA_POLE_POLE",
    priority: "URGENT",
    title: `${account.reference} is fully paid`,
    description: `${account.customer.name || account.customer.phone || "Customer"} is awaiting final conversion and product release approval.`,
    href: `/attendant/online/lipa-pole-pole?id=${encodeURIComponent(account.id)}`,
    actionLabel: "Complete approval",
    createdAt: account.updatedAt.toISOString(),
    contextLabel: "Pending approval",
  }));

  return [...paymentTasks, ...approvalTasks, ...applicationTasks];
}

export async function buildLiveSupervisorTodos(now = new Date()) {
  const queues = await Promise.all([
    getPricingTasks(),
    getJumiaTasks(now),
    getLipaPolePoleTasks(),
  ]);
  const priorityOrder: Record<SupervisorTodoPriority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2 };
  return queues
    .flat()
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
