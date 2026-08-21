import { NextResponse } from "next/server";
import { requireComplaintCustomer } from "@/lib/complaintAuth";
import { addComplaintMessage } from "@/lib/complaints";

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await requireComplaintCustomer();
  if (!access.ok) return access.response;
  try {
    const { reference } = await context.params;
    const body = await request.json() as { message?: unknown };
    const message = await addComplaintMessage({ reference, authorUserId: access.userId, customerId: access.userId, visibility: "CUSTOMER", message: body.message });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send message." }, { status: 400 });
  }
}
