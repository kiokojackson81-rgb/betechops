import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> } | Record<string, unknown>;

async function resolveId(context: ParamsContext) {
  const raw = (context as any)?.params ?? context;
  if (raw && typeof raw?.then === "function") {
    const awaited = await raw;
    return typeof awaited?.id === "string" ? awaited.id : undefined;
  }
  return typeof (raw as any)?.id === "string" ? (raw as any).id : undefined;
}

export async function PUT(req: Request, ctx: ParamsContext) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const bodyAttendantId = body?.attendantId as string | undefined;

  const {
    baseSalary,
    frequency,
    defaultChamaDeduction,
    defaultOtherDeduction,
    defaultTransportAllowance,
    notes,
  } = body || {};

  if (typeof baseSalary !== "number") return NextResponse.json({ error: "baseSalary required" }, { status: 400 });

  try {
    const paramId = await resolveId(ctx);
    const attendantId = paramId ?? bodyAttendantId;
    if (!attendantId) {
      return NextResponse.json({ error: "attendantId required" }, { status: 400 });
    }
    const plan = await prisma.attendantCompPlan.upsert({
      where: { attendantId },
      create: {
        attendantId,
        baseSalary: Math.max(0, Math.trunc(baseSalary)),
        frequency: frequency || "PERIOD",
        defaultChamaDeduction: defaultChamaDeduction ?? null,
        defaultOtherDeduction: defaultOtherDeduction ?? null,
        defaultTransportAllowance: defaultTransportAllowance ?? null,
        notes: notes ?? null,
      },
      update: {
        baseSalary: Math.max(0, Math.trunc(baseSalary)),
        frequency: frequency || "PERIOD",
        defaultChamaDeduction: defaultChamaDeduction ?? null,
        defaultOtherDeduction: defaultOtherDeduction ?? null,
        defaultTransportAllowance: defaultTransportAllowance ?? null,
        notes: notes ?? null,
      },
    });
    return NextResponse.json({ plan });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save comp plan";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
