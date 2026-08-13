import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { isBenjaminSupervisorEmail } from "@/lib/api";
import { getUnpricedDailySalesForCurrentPeriod } from "@/lib/marketingUnpricedSales";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  const attendantCategory = (session.user as { attendantCategory?: string }).attendantCategory;
  const email = (session.user as { email?: string }).email;
  const isBenjamin = isBenjaminSupervisorEmail(email);

  if (role !== "ADMIN" && attendantCategory !== "DIRECT_SALES_OPS" && !isBenjamin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let sales = await getUnpricedDailySalesForCurrentPeriod();
  if (isBenjamin) {
    sales = sales.filter((sale) => sale.source === "support");
  }

  return NextResponse.json({ sales });
}
