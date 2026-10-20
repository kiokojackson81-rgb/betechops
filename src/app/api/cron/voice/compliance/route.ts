import { NextResponse } from "next/server";
import { evaluateAllVoiceCompliance } from "@/lib/voiceCompliance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = String(process.env.VOICE_COMPLIANCE_CRON_SECRET || process.env.VOICE_HEALTH_CRON_SECRET || process.env.CRON_SECRET || "").trim();
  const authorization = request.headers.get("authorization") || "";
  return Boolean(secret && (authorization === `Bearer ${secret}` || authorization === secret || request.headers.get("x-cron-secret") === secret));
}

async function handle(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  try {
    const rows = await evaluateAllVoiceCompliance();
    return NextResponse.json({ ok: true, evaluated: rows.length });
  } catch (error) {
    console.error("[voice.compliance.cron_failed]", error);
    return NextResponse.json({ ok: false, error: "voice_compliance_failed" }, { status: 500 });
  }
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
