import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isCallFeedbackSchemaMissingError, listCallFeedback } from "@/lib/callFeedback";

export const dynamic = "force-dynamic";

function parseOptionalBoolean(value: string | null) {
  if (value == null || value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function parseDate(value: string | null, boundary: "start" | "end") {
  if (!value) return null;
  const suffix = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  const parsed = new Date(`${value}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
    const role = String((session?.user as { role?: string } | undefined)?.role || "").toUpperCase();
    if (!session || !userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") || "1");
    const pageSize = Number(url.searchParams.get("pageSize") || "20");
    const rating = Number(url.searchParams.get("rating") || "0") || null;
    const contactReason = url.searchParams.get("contactReason");
    const wantsContact = parseOptionalBoolean(url.searchParams.get("wantsContact"));
    const lowRatingOnly = url.searchParams.get("lowRatingOnly") === "true";
    const startDate = parseDate(url.searchParams.get("startDate"), "start");
    const endDate = parseDate(url.searchParams.get("endDate"), "end");

    const result = await listCallFeedback({
      page,
      pageSize,
      rating,
      contactReason,
      wantsContact,
      lowRatingOnly,
      startDate,
      endDate,
      agentId: ["ADMIN", "SUPERVISOR"].includes(role) ? null : userId,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    if (isCallFeedbackSchemaMissingError(error)) {
      return NextResponse.json({ ok: false, error: "feedback_setup_required" }, { status: 503 });
    }
    throw error;
  }
}
