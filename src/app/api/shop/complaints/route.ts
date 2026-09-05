import { NextResponse } from "next/server";
import { requireComplaintCustomer } from "@/lib/complaintAuth";
import { createCustomerComplaint, listCustomerComplaints } from "@/lib/complaints";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireComplaintCustomer();
  if (!access.ok) return access.response;
  return NextResponse.json({ complaints: await listCustomerComplaints(access.userId) });
}

export async function POST(request: Request) {
  const access = await requireComplaintCustomer();
  if (!access.ok) return access.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const result = await createCustomerComplaint({ identity: access.identity, input: body, forceDuplicate: body.forceDuplicate === true });
    if ("duplicate" in result) return NextResponse.json(result, { status: 409 });
    return NextResponse.json({ complaint: result.complaint }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not submit report." }, { status: 400 });
  }
}
