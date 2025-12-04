import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { prisma } from "@/lib/prisma";

type DeleteUnpricedSalePayload = {
  saleId: string;
  source: "daily-sale" | "support";
};

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  const email = session?.user?.email?.toLowerCase() ?? null;
  const role = (session?.user as { role?: string })?.role;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = role === "ADMIN" || email === "jeniffer@betech.co.ke";
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: DeleteUnpricedSalePayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { saleId, source } = payload ?? {};
  if (!saleId || typeof saleId !== "string") {
    return NextResponse.json({ error: "saleId is required" }, { status: 400 });
  }
  if (source !== "daily-sale" && source !== "support") {
    return NextResponse.json({ error: "source must be daily-sale or support" }, { status: 400 });
  }

  try {
    if (source === "daily-sale") {
      const sale = await prisma.dailySale.findUnique({
        where: { id: saleId },
        include: { marketingSales: true },
      });
      if (!sale) {
        return NextResponse.json({ error: "Sale not found" }, { status: 404 });
      }
      if (sale.marketingSales.length > 0) {
        return NextResponse.json({ error: "Sale already priced" }, { status: 409 });
      }
      await prisma.dailySale.delete({ where: { id: saleId } });
      return NextResponse.json({ ok: true, removed: "daily-sale" });
    }

    const item = await prisma.supportReceiptItem.findUnique({
      where: { id: saleId },
    });
    if (!item) {
      return NextResponse.json({ error: "Support sale not found" }, { status: 404 });
    }
    if (item.buyingPrice > 0) {
      return NextResponse.json({ error: "Sale already has a buying price" }, { status: 409 });
    }
    await prisma.supportReceiptItem.delete({ where: { id: saleId } });
    return NextResponse.json({ ok: true, removed: "support" });
  } catch (err) {
    console.error("Failed to delete unpriced sale", err);
    return NextResponse.json({ error: "Failed to delete sale" }, { status: 500 });
  }
}
