import { NextResponse } from "next/server";
import { getCustomerAccountContext } from "@/app/account/_lib/accountData";
import { getCustomerAccountOrderDetail } from "@/lib/shopCustomerOrders";
import { prisma } from "@/lib/prisma";
import { buildCommissioningCertificatePdf } from "@/lib/commissioningCertificate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type ParamsContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(_req: Request, context: ParamsContext) {
  const { id } = await context.params;
  const { identity } = await getCustomerAccountContext();
  const order = await getCustomerAccountOrderDetail({ routeId: `receipt-${id}`, ...identity });
  if (!order) return new NextResponse("Certificate unavailable", { status: 404 });
  const session = await prisma.commissioningSession.findUnique({
    where: { receiptId: id },
    include: { technician: { select: { name: true } }, receipt: { select: { receiptNumber: true, data: true, order: { select: { orderNumber: true, customerName: true, customerPhone: true, customerEmail: true, metadata: true } } } } },
  });
  if (!session || session.status !== "ISSUED") return new NextResponse("Certificate unavailable", { status: 404 });
  const pdf = await buildCommissioningCertificatePdf(session);
  const filename = `${(session.certificateNo || "betech-completion-certificate").replace(/[^a-zA-Z0-9_-]+/g, "-")}.pdf`;
  return new NextResponse(pdf, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } });
}
