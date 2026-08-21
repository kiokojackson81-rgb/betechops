import { NextResponse } from "next/server";
import { requireComplaintStaff } from "@/lib/complaintAuth";
import { complaintDashboardCounts, listAdminComplaints } from "@/lib/complaints";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireComplaintStaff();
  if (!access.ok) return access.response;
  const params = new URL(request.url).searchParams;
  const [complaints, counts] = await Promise.all([listAdminComplaints({ status: params.get("status") || undefined, priority: params.get("priority") || undefined, query: params.get("query") || undefined }), complaintDashboardCounts()]);
  return NextResponse.json({ complaints, counts });
}
