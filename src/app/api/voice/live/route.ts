import { NextResponse } from "next/server";
import {
  getVoiceLiveSnapshot,
  isVoiceOperationsSchemaMissingError,
  resolveVoiceViewer,
} from "@/lib/voiceOperations";
import { subscribeVoiceLiveEvent } from "@/lib/voiceLiveEvents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const viewer = await resolveVoiceViewer({
      impersonateId: url.searchParams.get("impersonateId"),
    });

    if (!viewer) {
      return NextResponse.json({ error: "not_authorized" }, { status: 401 });
    }

    if (url.searchParams.get("stream") === "1") {
      const encoder = new TextEncoder();
      const selectedCallId = url.searchParams.get("selectedCallId");
      const selectedPhone = url.searchParams.get("selectedPhone");

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          let closed = false;
          const writeEvent = (event: string, data: unknown) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          const safeClose = () => {
            if (closed) return;
            closed = true;
            clearInterval(heartbeat);
            clearTimeout(recycleTimeout);
            unsubscribe();
            try {
              controller.close();
            } catch {}
          };

          const sendSnapshot = async (reason: string) => {
            const snapshot = await getVoiceLiveSnapshot({
              viewer,
              selectedCallId,
              selectedPhone,
              scope: url.searchParams.get("scope") === "mine" ? "mine" : "all",
            });
            writeEvent("snapshot", { reason, snapshot });
          };

          await sendSnapshot("initial");

          const unsubscribe = subscribeVoiceLiveEvent((liveEvent) => {
            void sendSnapshot(liveEvent.reason).catch((error) => {
              console.error("[voice.live.sse_push_failed]", error);
            });
          });

          const heartbeat = setInterval(() => {
            if (closed) return;
            controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
            writeEvent("heartbeat", { at: new Date().toISOString() });
          }, 15000);

          const recycleTimeout = setTimeout(() => {
            if (closed) return;
            writeEvent("reconnect", { reason: "stream_recycle" });
            safeClose();
          }, 240000);

          request.signal.addEventListener(
            "abort",
            () => {
              safeClose();
            },
            { once: true },
          );
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const snapshot = await getVoiceLiveSnapshot({
      viewer,
      selectedCallId: url.searchParams.get("selectedCallId"),
      selectedPhone: url.searchParams.get("selectedPhone"),
      scope: url.searchParams.get("scope") === "mine" ? "mine" : "all",
    });

    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    console.error("[voice.live.failed]", error);
    if (isVoiceOperationsSchemaMissingError(error)) {
      return NextResponse.json(
        {
          error: "voice_operations_migration_missing",
          message: "Voice operations migration is not applied yet.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "voice_live_failed" }, { status: 500 });
  }
}
