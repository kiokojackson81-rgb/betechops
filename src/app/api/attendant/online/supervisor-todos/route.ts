import { NextResponse } from "next/server";
import { canAccessOnlineSupervisorWorkspace } from "@/lib/onlineSupervisorAccess";
import { buildLiveSupervisorTodos } from "@/lib/supervisorTodo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function authorize(impersonateId?: string | null) {
  if (!(await canAccessOnlineSupervisorWorkspace(impersonateId))) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function GET(request: Request) {
  const impersonateId = new URL(request.url).searchParams.get("impersonateId");
  const access = await authorize(impersonateId);
  if (!access.ok) return access.response;

  const items = await buildLiveSupervisorTodos();
  return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
}
