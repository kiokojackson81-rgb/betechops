import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { findAccessibleCommissioningSession } from "@/lib/commissioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = { params: Promise<{ token: string }> | { token: string } };

const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;

function imageContentType(file: File) {
  if (file.type.startsWith("image/")) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic" || extension === "heif") return "image/heic";
  return "";
}

export async function POST(req: Request, context: ParamsContext) {
  const { token } = await context.params;
  const session = await findAccessibleCommissioningSession(token);
  if (!session) return NextResponse.json({ error: "This commissioning link is invalid, revoked, or expired." }, { status: 404 });
  if (session.status !== "DRAFT") return NextResponse.json({ error: "Certificate Issued — View Only" }, { status: 409 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Evidence storage is not configured." }, { status: 503 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "The photo could not be read. Please retake it as a JPG or PNG image." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload an image file." }, { status: 400 });
  }
  const contentType = imageContentType(file);
  if (!contentType) return NextResponse.json({ error: "Upload a JPG, PNG, WEBP, or HEIC image." }, { status: 400 });
  if (file.size > MAX_EVIDENCE_SIZE) return NextResponse.json({ error: "This photo is too large. Retake it at a lower resolution or choose a photo smaller than 10 MB." }, { status: 400 });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100) || "evidence.jpg";
  try {
    const blob = await put(`commissioning/${session.id}/${Date.now()}-${safeName}`, Buffer.from(await file.arrayBuffer()), {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return NextResponse.json({ url: blob.url, key: blob.pathname, contentType, fileName: file.name, size: file.size });
  } catch (error) {
    console.error("[commissioning] evidence upload failed", {
      sessionId: session.id,
      fileName: file.name,
      size: file.size,
      contentType,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Photo storage could not save this image. Please retry; you can enter the equipment details manually while the photo is retried." },
      { status: 503 },
    );
  }
}
