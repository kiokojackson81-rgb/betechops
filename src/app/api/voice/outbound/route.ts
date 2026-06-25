import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  return NextResponse.json(
    {
      ok: false,
      error: "phase_one_not_enabled",
      message: "Outbound voice calling is not enabled in Phase 1.",
    },
    { status: 501 },
  );
}
