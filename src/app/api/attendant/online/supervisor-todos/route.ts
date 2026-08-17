import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessOnlineSupervisorWorkspace } from "@/lib/onlineSupervisorAccess";
import { confirmSupervisorTodo, syncSupervisorTodos } from "@/lib/supervisorTodo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function authorize(impersonateId?: string | null) {
  if (!(await canAccessOnlineSupervisorWorkspace(impersonateId))) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const session = await auth();
  const actorId = String((session?.user as { id?: string } | undefined)?.id ?? "").trim();
  if (!actorId) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true as const, actorId };
}

export async function GET(request: Request) {
  const impersonateId = new URL(request.url).searchParams.get("impersonateId");
  const access = await authorize(impersonateId);
  if (!access.ok) return access.response;

  const items = await syncSupervisorTodos(access.actorId);
  return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { key?: string; impersonateId?: string } | null;
  const key = String(body?.key ?? "").trim();
  if (!key) return NextResponse.json({ error: "Task key is required." }, { status: 400 });

  const access = await authorize(body?.impersonateId);
  if (!access.ok) return access.response;
  try {
    await confirmSupervisorTodo({ actorId: access.actorId, key });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to confirm task.";
    if (message === "TODO_STILL_PENDING") {
      return NextResponse.json({ error: "This task is still pending. Complete the linked work first, then confirm again." }, { status: 409 });
    }
    if (message === "TODO_NOT_FOUND") {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to confirm task." }, { status: 500 });
  }
}
