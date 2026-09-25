import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseVoiceStaffCommand } from "@/lib/voiceCommands";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Controlled test harness: records a proposed command only. */
export async function POST(request: Request) {
  if (process.env.BETECH_VOICE_COMMANDS_TEST_MODE !== "true") {
    return NextResponse.json({ ok: false, error: "test_mode_disabled" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({})) as { callId?: string; code?: string };
  const command = parseVoiceStaffCommand(body.code);
  if (!body.callId || !command) {
    return NextResponse.json({ ok: false, error: "invalid_call_or_command" }, { status: 400 });
  }
  const call = await prisma.voiceCall.findUnique({ where: { id: body.callId }, select: { id: true, sessionId: true, isActive: true } });
  if (!call?.isActive) return NextResponse.json({ ok: false, error: "active_call_required" }, { status: 409 });
  await prisma.voiceEvent.create({
    data: { voiceCallId: call.id, sessionId: call.sessionId, eventType: "VOICE_COMMAND_TEST_RECEIVED", payloadJson: command },
  });
  return NextResponse.json({ ok: true, command, executed: false });
}
