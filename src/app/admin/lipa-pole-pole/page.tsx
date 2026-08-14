import { headers } from "next/headers";
import { absUrl, withParams } from "@/lib/abs-url";
import LipaPolePoleAdminClient from "@/app/admin/lipa-pole-pole/LipaPolePoleAdminClient";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  id?: string;
}>;

type LppListItem = {
  id: string;
  reference: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  productId: string | null;
  productName: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  agreedTotal: number;
  totalPaid: number;
  balance: number;
  percentagePaid: number;
  status: string;
  expectedCompletionDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  convertedAt: string | null;
  convertedReceiptId: string | null;
  convertedProjectId: string | null;
  fulfilledAt: string | null;
  fulfilledById: string | null;
  fulfilledByName: string | null;
  fulfillmentMethod: string | null;
};

type LppDetail = {
  account: LppListItem;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    reference: string | null;
    status: string;
    receivedById: string | null;
    receivedAt: string;
    notes: string | null;
    reversedAt: string | null;
    reversalReason: string | null;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    actorId: string | null;
    metadata: unknown;
    createdAt: string;
  }>;
  reminders: Array<{
    id: string;
    reminderType: string;
    scheduledFor: string;
    sentAt: string | null;
    channel: string;
    status: string;
    providerMessageId: string | null;
    idempotencyKey: string;
    payloadSnapshot: unknown;
    createdAt: string;
  }>;
  followUps: Array<{
    id: string;
    assignedToId: string | null;
    assignedToName: string | null;
    outcome: string | null;
    taskType: string;
    taskDate: string | null;
    notes: string | null;
    createdById: string | null;
    createdByName: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  promises: Array<{
    id: string;
    promiseAmount: number;
    promiseDate: string;
    status: string;
    notes: string | null;
    createdById: string | null;
    createdByName: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  summary: {
    agreedTotal: number;
    totalPaid: number;
    balance: number;
    percentagePaid: number;
    isFullyPaid: boolean;
  };
};

async function fetchJson<T>(path: string) {
  const incomingHeaders = await headers();
  const cookieHeader = incomingHeaders.get("cookie") ?? undefined;
  const res = await fetch(await absUrl(path), {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  return (await res.json()) as T;
}

export default async function AdminLipaPolePolePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = (await searchParams) || {};
  const q = (params.q || "").trim();
  const status = (params.status || "ALL").trim().toUpperCase();
  const selectedId = (params.id || "").trim();

  const listPayload = await fetchJson<{ items?: LppListItem[] }>(
    withParams("/api/lipa-pole-pole", {
      q: q || undefined,
      status: status !== "ALL" ? status : undefined,
      limit: 100,
    }),
  );
  const items = Array.isArray(listPayload.items) ? listPayload.items : [];

  const activeId = selectedId || items[0]?.id || "";
  const detailPayload = activeId
    ? await fetchJson<({ ok: true } & LppDetail) | { error?: string }>(`/api/lipa-pole-pole/${activeId}`)
    : null;
  const detail = detailPayload && "account" in detailPayload ? detailPayload : null;

  return (
    <LipaPolePoleAdminClient
      initialItems={items}
      initialDetail={detail}
      initialQ={q}
      initialStatus={status}
    />
  );
}
