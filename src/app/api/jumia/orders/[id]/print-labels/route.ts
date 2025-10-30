import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { noStoreJson, requireRole } from "@/lib/api";
import { postOrdersPrintLabels } from "@/lib/jumia";

type LabelPayload = { base64: string; filename: string; contentType: string };

function normalizeIdsFromBody(body: unknown, fallbackId: string): string[] {
  if (body && typeof body === "object") {
    const ids = (body as { orderItemIds?: unknown }).orderItemIds;
    if (Array.isArray(ids)) {
      const cleaned = ids
        .map((id) => (typeof id === "string" || typeof id === "number" ? String(id).trim() : ""))
        .filter(Boolean);
      if (cleaned.length) return cleaned;
    }
    const single = (body as { orderItemId?: unknown }).orderItemId;
    if (typeof single === "string" || typeof single === "number") {
      const normalized = String(single).trim();
      if (normalized) return [normalized];
    }
  }
  return fallbackId ? [fallbackId] : [];
}

function extractLabel(data: unknown, fallbackName: string): LabelPayload | null {
  if (!data) return null;
  if (typeof data === "object" && "_binary" in (data as Record<string, unknown>)) {
    const record = data as { _binary?: string; contentType?: string };
    if (record._binary && typeof record._binary === "string") {
      return {
        base64: record._binary,
        filename: `${fallbackName}.pdf`,
        contentType: record.contentType || "application/pdf",
      };
    }
  }
  const haystacks: unknown[] = [];
  if (typeof data === "object") {
    haystacks.push(data);
    const success = (data as any)?.success;
    if (success) haystacks.push(success);
    const firstOrderItem = Array.isArray(success?.labels) ? success.labels[0] : undefined;
    if (firstOrderItem) haystacks.push(firstOrderItem);
  }
  for (const entry of haystacks) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Record<string, unknown>;
    const label =
      (typeof candidate.label === "string" && candidate.label) ||
      (typeof candidate.labelBase64 === "string" && candidate.labelBase64) ||
      (typeof candidate.content === "string" && candidate.content);
    if (label) {
      const filename =
        (typeof candidate.labelFilename === "string" && candidate.labelFilename) ||
        (typeof candidate.filename === "string" && candidate.filename) ||
        `${fallbackName}.pdf`;
      return { base64: label, filename, contentType: "application/pdf" };
    }
  }
  return null;
}

async function fetchLabels(orderItemIds: string[]) {
  return await postOrdersPrintLabels({ orderItemIds });
}

async function respondWithPdf(orderItemIds: string[], identifier: string) {
  const result = await fetchLabels(orderItemIds);
  const label = extractLabel(result, identifier);
  if (!label) return null;
  const buf = Buffer.from(label.base64, "base64");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": label.contentType,
      "Content-Length": String(buf.length),
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="${encodeURIComponent(label.filename)}"`,
    },
  });
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const orderItemIds = id ? [id] : [];
  if (!orderItemIds.length) {
    return noStoreJson({ ok: false, error: "order item id required" }, { status: 400 });
  }

  try {
    const pdf = await respondWithPdf(orderItemIds, id);
    if (pdf) return pdf;
    const result = await fetchLabels(orderItemIds);
    return noStoreJson({ ok: false, error: "Label not available", result }, { status: 502 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return noStoreJson({ ok: false, error: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  let body: unknown = undefined;
  if (req.headers.get("content-type")?.includes("application/json")) {
    try {
      body = await req.json();
    } catch {
      return noStoreJson({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
    }
  }

  const orderItemIds = normalizeIdsFromBody(body, id);
  if (!orderItemIds.length) {
    return noStoreJson({ ok: false, error: "orderItemIds required" }, { status: 400 });
  }

  try {
    const labelResponse = await respondWithPdf(orderItemIds, orderItemIds[0] ?? id);
    if (labelResponse) return labelResponse;
    const fallback = await fetchLabels(orderItemIds);
    return noStoreJson({ ok: true, result: fallback, orderItemIds });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return noStoreJson({ ok: false, error: message }, { status: 502 });
  }
}
