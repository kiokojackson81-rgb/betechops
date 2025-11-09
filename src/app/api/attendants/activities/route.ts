import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActorId, requireRole } from "@/lib/api";
import { ATTENDANT_ACTIVITY_METRICS } from "@/lib/attendants/categories";
import { AttendantCategory } from "@prisma/client";

const metricValues = new Set(Object.keys(ATTENDANT_ACTIVITY_METRICS));

export async function GET(request: Request) {
  const auth = await requireRole(["ATTENDANT", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const actorId = await getActorId();
  if (!actorId) return NextResponse.json({ error: "actor_not_found" }, { status: 403 });

  const url = new URL(request.url);
  const requestedUserId = url.searchParams.get("userId") || undefined;
  const metric = url.searchParams.get("metric") || undefined;
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get("take") || 20)));

  const userId = auth.role === "ADMIN" && requestedUserId ? requestedUserId : actorId;

  const where = {
    userId,
    ...(metric && metricValues.has(metric) ? { metric } : {}),
  };

  const items = await prisma.attendantActivity.findMany({
    where,
    orderBy: { entryDate: "desc" },
    take,
  });

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const auth = await requireRole(["ATTENDANT", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const actorId = await getActorId();
  if (!actorId) return NextResponse.json({ error: "actor_not_found" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    metric?: string;
    numericValue?: number;
    intValue?: number;
    notes?: string;
    entryDate?: string;
    category?: string;
  };

  const metric = body.metric?.toUpperCase();
  if (!metric || !metricValues.has(metric)) {
    return NextResponse.json({ error: "invalid_metric" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: { attendantCategory: true, categoryAssignments: { select: { category: true } } },
  });
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const categoryPool = user.categoryAssignments.map((c) => c.category);
  if (!categoryPool.includes(user.attendantCategory)) categoryPool.unshift(user.attendantCategory);
  const requestedCategory = body.category?.toUpperCase() || undefined;
  const effectiveCategory =
    requestedCategory && categoryPool.includes(requestedCategory as AttendantCategory)
      ? (requestedCategory as AttendantCategory)
      : categoryPool[0] ?? user.attendantCategory;

  const numericValue =
    typeof body.numericValue === "number" && Number.isFinite(body.numericValue) ? Number(body.numericValue.toFixed(2)) : undefined;
  const intValue = typeof body.intValue === "number" && Number.isInteger(body.intValue) ? body.intValue : undefined;

  if (numericValue === undefined && intValue === undefined) {
    return NextResponse.json({ error: "missing_value" }, { status: 400 });
  }

  let entryDate: Date | undefined;
  if (body.entryDate) {
    const parsed = new Date(body.entryDate);
    if (!Number.isFinite(parsed.valueOf())) {
      return NextResponse.json({ error: "invalid_date" }, { status: 400 });
    }
    entryDate = parsed;
  }

  const record = await prisma.attendantActivity.create({
    data: {
      userId: actorId,
      category: effectiveCategory,
      metric,
      numericValue: numericValue ?? null,
      intValue: intValue ?? null,
      notes: body.notes?.slice(0, 500) ?? null,
      entryDate: entryDate ?? new Date(),
    },
  });

  return NextResponse.json({ ok: true, activity: record }, { status: 201 });
}
