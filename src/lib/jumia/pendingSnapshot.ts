import { prisma } from "../prisma";

export const PENDING_SNAPSHOT_KEY = "jumia:pending-live";

export type PendingSnapshotShop = {
  shopId: string;
  orders: number;
  pages: number;
  error?: string | null;
};

export type PendingSnapshot = {
  ok: boolean;
  startedAt: string;
  completedAt: string;
  tookMs: number;
  windowDays: number;
  pageSize: number;
  totalOrders: number;
  totalPages: number;
  shopCount: number;
  accountCount: number;
  perShop: PendingSnapshotShop[];
  error?: string | null;
};

export async function writePendingSnapshot(snapshot: PendingSnapshot): Promise<void> {
  await prisma.config.upsert({
    where: { key: PENDING_SNAPSHOT_KEY },
    update: { json: snapshot },
    create: { key: PENDING_SNAPSHOT_KEY, json: snapshot },
  });
}

export async function readPendingSnapshot(): Promise<PendingSnapshot | null> {
  try {
    const row = await prisma.config.findUnique({ where: { key: PENDING_SNAPSHOT_KEY } });
    if (!row?.json) return null;
    const snapshot = row.json as PendingSnapshot;
    if (typeof snapshot?.totalOrders !== "number") return null;
    return snapshot;
  } catch (error) {
    console.error("[jumia.pendingSnapshot] read failed", error);
    return null;
  }
}

export function isPendingSnapshotFresh(snapshot: PendingSnapshot, maxAgeMs: number): boolean {
  const referenceIso = snapshot?.completedAt || snapshot?.startedAt;
  if (!referenceIso) return false;
  const referenceMs = Date.parse(referenceIso);
  if (!Number.isFinite(referenceMs)) return false;
  return Date.now() - referenceMs <= maxAgeMs;
}
