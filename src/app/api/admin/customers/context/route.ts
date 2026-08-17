import { NextResponse } from "next/server";
import { getAdminCustomerContext } from "@/lib/adminCustomerContext";
import { requireRoleOrBenjamin } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function splitList(value: string | null) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  const access = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!access.ok) return access.res;

  try {
    const url = new URL(request.url);
    const detail = await getAdminCustomerContext({
      customerUserId: url.searchParams.get("customerUserId"),
      displayName: url.searchParams.get("displayName"),
      phones: splitList(url.searchParams.get("phones")),
      emails: splitList(url.searchParams.get("emails")),
    });

    return NextResponse.json(detail, { status: 200 });
  } catch (error) {
    console.error("[admin.customers.context.failed]", error);
    return NextResponse.json({ error: "Failed to load customer context." }, { status: 500 });
  }
}
