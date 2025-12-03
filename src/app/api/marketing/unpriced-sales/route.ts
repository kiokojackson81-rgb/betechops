import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { getUnpricedDailySalesForCurrentPeriod } from "@/lib/marketingUnpricedSales";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  const attendantCategory = (session.user as { attendantCategory?: string }).attendantCategory;
  if (role !== "ADMIN" && attendantCategory !== "DIRECT_SALES_OPS") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sales = await getUnpricedDailySalesForCurrentPeriod();
  return NextResponse.json({ sales });
}
