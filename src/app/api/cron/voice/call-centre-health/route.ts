import { NextResponse } from "next/server";
import { runCallCentreInactivityCheck } from "@/lib/voiceCallCentreHealth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorizedCron(request: Request) {
  const secret = String(process.env.VOICE_HEALTH_CRON_SECRET || process.env.CRON_SECRET || "").trim();
  const authorization = request.headers.get("authorization") || "";
  const cronSecret = request.headers.get("x-cron-secret") || "";
  return Boolean(
    secret &&
      (authorization === `Bearer ${secret}` || authorization === secret || cronSecret === secret),
  );
}

async function handle(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  try {
    const snapshot = await runCallCentreInactivityCheck();
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    console.error("[voice.call_centre_health.cron_failed]", error);
    return NextResponse.json({ ok: false, error: "health_check_failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
