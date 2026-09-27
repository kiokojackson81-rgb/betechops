import { handleUpload } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const CV_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const MAX_CV_BYTES = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const isCv = pathname.startsWith("career-applications/cv/");
        const isVideo = pathname.startsWith("career-applications/video/");
        if (!isCv && !isVideo) throw new Error("Invalid career application upload path.");
        return {
          allowedContentTypes: isCv ? CV_TYPES : VIDEO_TYPES,
          maximumSizeInBytes: isCv ? MAX_CV_BYTES : MAX_VIDEO_BYTES,
          validUntil: Date.now() + 10 * 60 * 1000,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => undefined,
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("[career] video upload token failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "We could not upload your video. Please try again." }, { status: 400 });
  }
}
