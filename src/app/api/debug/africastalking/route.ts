import { NextResponse } from "next/server";
import { getAfricaTalkingConfig } from "@/lib/africasTalking";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getAfricaTalkingConfig();
    return NextResponse.json({
      username: config.username,
      senderId: config.senderId || null,
      hasApiKey: Boolean(config.apiKey),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Africa's Talking config unavailable.",
      },
      { status: 500 },
    );
  }
}
