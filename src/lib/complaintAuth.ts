import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findSafeCustomerProfileByUserId } from "@/lib/customerProfile";
import { buildCustomerAccountIdentity } from "@/lib/shopCustomerOrders";
import { complaintStaffAccess } from "@/lib/complaints";

export async function requireComplaintCustomer() {
  const session = await auth().catch(() => null);
  const user = session?.user as { id?: string | null; phone?: string | null; email?: string | null } | undefined;
  if (!user?.id) return { ok: false as const, response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  const profile = await findSafeCustomerProfileByUserId(user.id);
  return { ok: true as const, userId: user.id, identity: buildCustomerAccountIdentity({ id: user.id, phone: user.phone, email: user.email }, profile) };
}

export async function requireComplaintStaff() {
  const session = await auth().catch(() => null);
  const user = session?.user as { id?: string | null; role?: string | null; attendantCategory?: string | null; name?: string | null; email?: string | null } | undefined;
  if (!user?.id) return { ok: false as const, response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  if (!complaintStaffAccess(user)) return { ok: false as const, response: NextResponse.json({ error: "You do not have complaint-management access." }, { status: 403 }) };
  return { ok: true as const, user: { id: user.id, role: user.role || "", attendantCategory: user.attendantCategory || null, name: user.name || null, email: user.email || null } };
}
