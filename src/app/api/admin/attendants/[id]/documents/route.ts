import { NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getTargetId(request: Request) {
  const pathname = new URL(request.url).pathname;
  const parts = pathname.split("/").filter(Boolean);
  const attendantsIndex = parts.findIndex((part) => part === "attendants");
  return attendantsIndex >= 0 ? parts[attendantsIndex + 1] || "" : "";
}

function serializeDocument(document: {
  id: string;
  documentType: string;
  title: string;
  fileUrl: string;
  fileKey: string | null;
  notes: string | null;
  createdAt: Date;
  uploadedBy?: { id: string; name: string | null; email: string | null } | null;
}) {
  return {
    id: document.id,
    documentType: document.documentType,
    title: document.title,
    fileUrl: document.fileUrl,
    fileKey: document.fileKey,
    notes: document.notes,
    createdAt: document.createdAt.toISOString(),
    uploadedBy: document.uploadedBy
      ? {
          id: document.uploadedBy.id,
          name: document.uploadedBy.name,
          email: document.uploadedBy.email,
        }
      : null,
  };
}

export async function GET(request: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const userId = getTargetId(request);
  if (!userId) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const documents = await prisma.employeeDocument.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }],
    include: {
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    documents: documents.map(serializeDocument),
  });
}

export async function POST(request: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const userId = getTargetId(request);
  if (!userId) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob storage is not configured" }, { status: 500 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const documentType = String(form.get("documentType") ?? "OTHER").trim() || "OTHER";
  const notes = String(form.get("notes") ?? "").trim() || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file_is_required" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "title_is_required" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const pathname = `employee-documents/${userId}/${Date.now()}-${safeName}`;
  const arrayBuffer = await file.arrayBuffer();
  const blob = await put(pathname, Buffer.from(arrayBuffer), {
    access: "public",
    contentType: file.type || "application/octet-stream",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  const actorId = await getActorId();
  const created = await prisma.employeeDocument.create({
    data: {
      userId,
      uploadedById: actorId,
      documentType,
      title,
      fileUrl: blob.url,
      fileKey: blob.pathname,
      notes,
    },
    include: {
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    document: serializeDocument(created),
  });
}

export async function DELETE(request: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const userId = getTargetId(request);
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId")?.trim() || "";

  if (!userId) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  if (!documentId) return NextResponse.json({ error: "missing_document_id" }, { status: 400 });

  const existing = await prisma.employeeDocument.findFirst({
    where: { id: documentId, userId },
    select: { id: true, fileKey: true },
  });

  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.employeeDocument.delete({ where: { id: existing.id } });

  if (existing.fileKey && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(existing.fileKey, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch (error) {
      console.error("[employee-documents] failed to delete blob", error);
    }
  }

  return NextResponse.json({ ok: true, deleted: true, documentId: existing.id });
}
