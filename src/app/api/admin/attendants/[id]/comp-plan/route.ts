import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, ctx: any) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const params = (ctx && (ctx.params || ctx)) || {};
  const attendantId = params.id as string;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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
