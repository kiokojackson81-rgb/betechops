import { NextResponse } from "next/server";
import { requireComplaintStaff } from "@/lib/complaintAuth";
import { getStaffComplaint, updateComplaintByStaff } from "@/lib/complaints";

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await requireComplaintStaff();
  if (!access.ok) return access.response;
  const complaint = await getStaffComplaint((await context.params).reference);
  return complaint ? NextResponse.json({ complaint }) : NextResponse.json({ error: "Complaint not found." }, { status: 404 });
}

export async function PATCH(request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await requireComplaintStaff();
  if (!access.ok) return access.response;
  try {
    const complaint = await updateComplaintByStaff({ reference: (await context.params).reference, actorUserId: access.user.id, input: await request.json() as Record<string, unknown> });
    return NextResponse.json({ complaint });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update complaint." }, { status: 400 });
  }
}
