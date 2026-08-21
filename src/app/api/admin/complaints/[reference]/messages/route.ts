import { NextResponse } from "next/server";
import { requireComplaintStaff } from "@/lib/complaintAuth";
import { addComplaintMessage } from "@/lib/complaints";

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await requireComplaintStaff();
  if (!access.ok) return access.response;
  try {
    const body = await request.json() as { message?: unknown; visibility?: string };
    const message = await addComplaintMessage({ reference: (await context.params).reference, authorUserId: access.user.id, visibility: body.visibility === "INTERNAL" ? "INTERNAL" : "CUSTOMER", message: body.message });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save message." }, { status: 400 });
  }
}
