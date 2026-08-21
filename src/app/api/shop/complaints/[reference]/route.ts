import { NextResponse } from "next/server";
import { requireComplaintCustomer } from "@/lib/complaintAuth";
import { getCustomerComplaint } from "@/lib/complaints";

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await requireComplaintCustomer();
  if (!access.ok) return access.response;
  const { reference } = await context.params;
  const complaint = await getCustomerComplaint(reference, access.userId);
  return complaint ? NextResponse.json({ complaint }) : NextResponse.json({ error: "Complaint not found." }, { status: 404 });
}
