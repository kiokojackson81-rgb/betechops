import { NextRequest, NextResponse } from "next/server";
import { requireRoleOrBenjamin } from "@/lib/api";
import { sendDividedWhatsappReport } from "@/lib/dividedWhatsapp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

export async function POST(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id;
  if (!actorId) return NextResponse.json({ error: "Missing actor id" }, { status: 401 });

  let body: { weekStart?: string; periodKey?: string } = {};
  try {
    body = (await req.json().catch(() => ({}))) as { weekStart?: string; periodKey?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const weekStartRaw = normalize(body.weekStart);
  if (!weekStartRaw) {
    return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
  }

  try {
    const responsePayload = await sendDividedWhatsappReport({
      weekStartRaw,
      actorId,
      mode: "manual",
    });

    console.info("[divided][whatsapp] triggered", responsePayload);
    return NextResponse.json(responsePayload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[divided][whatsapp] failed", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
