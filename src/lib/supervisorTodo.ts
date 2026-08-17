import { Prisma } from "@prisma/client";
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

export type SupervisorTodoItem = SupervisorTodoTask & {
  readyToConfirm: boolean;
};

const TODO_ENTITY = "SupervisorTodo";
const TODO_CREATED = "TODO_CREATED";
const TODO_COMPLETED = "TODO_COMPLETED";

function isTaskSnapshot(value: unknown): value is SupervisorTodoTask {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const task = value as Record<string, unknown>;
  return ["key", "category", "priority", "title", "description", "href", "actionLabel", "createdAt"].every(
    (field) => typeof task[field] === "string",
  );
}

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
  return queues.flat();
}

export async function syncSupervisorTodos(actorId: string) {
  const liveTasks = await buildLiveSupervisorTodos();
  const logs = await prisma.actionLog.findMany({
    where: { entity: TODO_ENTITY, action: { in: [TODO_CREATED, TODO_COMPLETED] } },
    select: { entityId: true, action: true, after: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  const completedKeys = new Set(logs.filter((log) => log.action === TODO_COMPLETED).map((log) => log.entityId));
  const createdByKey = new Map<string, SupervisorTodoTask>();
  for (const log of logs) {
    if (log.action === TODO_CREATED && !createdByKey.has(log.entityId) && isTaskSnapshot(log.after)) {
      createdByKey.set(log.entityId, log.after);
    }
  }

  const newTasks = liveTasks.filter((task) => !createdByKey.has(task.key) && !completedKeys.has(task.key));
  if (newTasks.length) {
    await prisma.actionLog.createMany({
      data: newTasks.map((task) => ({
        actorId,
        entity: TODO_ENTITY,
        entityId: task.key,
        action: TODO_CREATED,
        after: task as unknown as Prisma.InputJsonValue,
      })),
    });
    for (const task of newTasks) createdByKey.set(task.key, task);
  }

  const liveKeys = new Set(liveTasks.map((task) => task.key));
  const priorityOrder: Record<SupervisorTodoPriority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2 };
  const items = Array.from(createdByKey.values())
    .filter((task) => !completedKeys.has(task.key))
    .map<SupervisorTodoItem>((task) => ({ ...task, readyToConfirm: !liveKeys.has(task.key) }))
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return items;
}

export async function confirmSupervisorTodo(input: { actorId: string; key: string }) {
  const liveTasks = await buildLiveSupervisorTodos();
  if (liveTasks.some((task) => task.key === input.key)) {
    throw new Error("TODO_STILL_PENDING");
  }
  const existing = await prisma.actionLog.findFirst({
    where: { entity: TODO_ENTITY, entityId: input.key, action: TODO_CREATED },
    select: { id: true },
  });
  if (!existing) throw new Error("TODO_NOT_FOUND");

  const alreadyCompleted = await prisma.actionLog.findFirst({
    where: { entity: TODO_ENTITY, entityId: input.key, action: TODO_COMPLETED },
    select: { id: true },
  });
  if (!alreadyCompleted) {
    await prisma.actionLog.create({
      data: {
        actorId: input.actorId,
        entity: TODO_ENTITY,
        entityId: input.key,
        action: TODO_COMPLETED,
        after: { confirmedAt: new Date().toISOString() },
      },
    });
  }
}
