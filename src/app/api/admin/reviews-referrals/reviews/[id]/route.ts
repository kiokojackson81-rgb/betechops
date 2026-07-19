import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteReviewSubmissionAdmin, setReviewSubmissionPublished } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session || (role !== "ADMIN" && role !== "SUPERVISOR")) {
    return null;
  }
  return session;
}

type ParamsContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, context: ParamsContext) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await req.json().catch(() => null)) as { published?: boolean } | null;
  if (typeof body?.published !== "boolean") {
    return NextResponse.json({ error: "Published flag is required." }, { status: 400 });
  }

  try {
    await setReviewSubmissionPublished(id, body.published);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update review." },
      { status: 400 },
    );
  }
}

export async function DELETE(_req: Request, context: ParamsContext) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    await deleteReviewSubmissionAdmin(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete review." },
      { status: 400 },
    );
  }
}
