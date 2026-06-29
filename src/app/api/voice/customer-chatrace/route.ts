import { NextResponse } from "next/server";
import { lookupChatraceContactByPhone } from "@/lib/integrations/chatrace";
import { resolveVoiceViewer } from "@/lib/voiceOperations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const viewer = await resolveVoiceViewer({
      impersonateId: url.searchParams.get("impersonateId"),
    });

    if (!viewer) {
      return NextResponse.json({ error: "not_authorized" }, { status: 401 });
    }

    const phone = url.searchParams.get("phone");
    const result = await lookupChatraceContactByPhone(phone);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[voice.customer_chatrace.failed]", error);
    return NextResponse.json(
      {
        found: false,
        normalizedPhone: "",
        tags: [],
        customFields: [],
        lastMessagePreview: null,
        profileUrl: null,
        sourceError: true,
      },
      { status: 200 },
    );
  }
}
