import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAttendant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOnlineQuickStats } from "@/lib/onlineOps";

export const dynamic = "force-dynamic";

const SELF_IDS = new Set(["me", "self", "current"]);
const PRIVILEGED_ROLES = new Set(["ADMIN", "SUPERVISOR"]);

type GuardResult =
  | Awaited<ReturnType<typeof requireAttendant>>
  | { ok: false; res: NextResponse };

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const serializeWeeklySale = (sale: any) => ({
  id: sale.id,
  shopId: sale.shopId,
  userId: sale.userId,
  weekStart: sale.weekStart,
  weekEnd: sale.weekEnd,
  amount: Number(sale.amount ?? 0),
  status: sale.status,
  createdAt: sale.createdAt,
});

const resolveTargetUserId = (auth: GuardResult, requested: string | null) => {
  if (!auth.ok) return null;
  const candidate = requested?.trim();
  if (!candidate || SELF_IDS.has(candidate.toLowerCase())) {
    return auth.user.id;
  }
  if (candidate === auth.user.id) {
    return candidate;
  }
  const role = auth.role ?? auth.user.role;
  if (role && PRIVILEGED_ROLES.has(role)) {
    return candidate;
  }
  return null;
};

export async function GET(req: NextRequest) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const requestedUserId = url.searchParams.get("userId");
  if (requestedUserId) {
    const targetUserId = resolveTargetUserId(auth, requestedUserId);
    if (!targetUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const sales = await prisma.weeklySale.findMany({
      where: { userId: targetUserId },
      orderBy: { weekStart: "desc" },
    });
    return NextResponse.json(sales.map(serializeWeeklySale));
  }

  const stats = await getOnlineQuickStats(auth.user.id);
  return NextResponse.json({ stats });
}

export async function POST(req: NextRequest) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { userId: rawUserId, shopId, weekStart, weekEnd, amount, status } = payload;
  const targetUserId = resolveTargetUserId(auth, typeof rawUserId === "string" ? rawUserId : null);
  if (!targetUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!weekStart || !weekEnd || amount === undefined || amount === null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const startDate = new Date(String(weekStart));
  const endDate = new Date(String(weekEnd));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Invalid week range" }, { status: 400 });
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const statusRaw =
    typeof status === "string" && status.trim().length
      ? status.trim().toUpperCase()
      : "PENDING";
  const normalizedStatus = statusRaw === "PAID" ? "PAID" : "PENDING";

  const sale = await prisma.weeklySale.create({
    data: {
      userId: targetUserId,
      shopId: typeof shopId === "string" && shopId.length ? shopId : null,
      weekStart: startDate,
      weekEnd: endDate,
      amount: new Prisma.Decimal(numericAmount.toFixed(2)),
      status: normalizedStatus,
    },
  });

  return NextResponse.json(serializeWeeklySale(sale), { status: 201 });
}
