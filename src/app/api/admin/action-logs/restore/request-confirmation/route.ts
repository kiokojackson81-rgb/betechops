import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getActorId } from "@/lib/api";
import { z } from "zod";

const RequestSchema = z.object({ actionLogId: z.string() });

function makeToken() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export async function POST(req: Request) {
  const authz = await requireRole("ADMIN");
  if (!authz.ok) return authz.res;

  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsed: z.infer<typeof RequestSchema>;
  try {
    parsed = RequestSchema.parse(body);
  } catch (err: unknown) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const { actionLogId } = parsed;
    const target = await prisma.actionLog.findUnique({ where: { id: actionLogId } });
    if (!target) return NextResponse.json({ error: "ActionLog not found" }, { status: 404 });
    if (target.action !== "WIPE_RECEIPTS") return NextResponse.json({ error: "Target is not a wipe" }, { status: 400 });

    const actorId = await getActorId();
    const now = new Date();

    // simple rate-limit: max 3 requests in last 10 minutes
    const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const recent = await prisma.actionLog.count({ where: { action: "REQUEST_RESTORE_CONFIRM", actorId: actorId || undefined, createdAt: { gte: tenMinsAgo } } });
    if (recent >= 3) return NextResponse.json({ error: "Too many confirmation requests. Try again later." }, { status: 429 });

    const token = makeToken();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // token valid 10 minutes

    const created = await prisma.actionLog.create({ data: { actorId: actorId || "", entity: "MarketingDailyEntry", entityId: target.entityId, action: "REQUEST_RESTORE_CONFIRM", before: undefined as any, after: { token, originalWipeId: actionLogId, expiresAt, consumed: false } as any } });

    return NextResponse.json({ ok: true, token, expiresAt }, { status: 200 });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "request failed" }, { status: 500 });
  }
}
