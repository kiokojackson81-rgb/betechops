import { NextRequest, NextResponse } from "next/server";
import { requireRoleOrBenjamin } from "@/lib/api";
import { sendPricingWeekWhatsapp } from "@/lib/pricingWeekWhatsapp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalize(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id;
  if (!actorId) return NextResponse.json({ error: "Missing actor id" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { weekStart?: string; force?: boolean } | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const weekStart = normalize(body.weekStart);
  if (!weekStart) return NextResponse.json({ error: "weekStart is required" }, { status: 400 });

  try {
    const result = await sendPricingWeekWhatsapp({
      weekStartRaw: weekStart,
      actorId,
      force: Boolean(body.force),
    });

    if (result.status === "not_eligible") {
      return NextResponse.json(result, { status: 409, headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
