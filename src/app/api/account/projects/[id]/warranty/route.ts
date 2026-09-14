import { NextResponse } from "next/server";
import { getCustomerAccountContext } from "@/app/account/_lib/accountData";
import { getCustomerAccountOrderDetail } from "@/lib/shopCustomerOrders";
import { getWarrantyCertificate, warrantyPdfBytes } from "@/lib/warrantyCertificates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type ParamsContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(_request: Request, context: ParamsContext) {
  const { id } = await context.params;
  const { identity } = await getCustomerAccountContext();
  const order = await getCustomerAccountOrderDetail({ routeId: `receipt-${id}`, ...identity });
  if (!order) return new NextResponse("Warranty certificate unavailable", { status: 404 });
  const certificate = await getWarrantyCertificate(id);
  if (!certificate) return new NextResponse("Warranty certificate unavailable", { status: 404 });
  try {
    const pdf = await warrantyPdfBytes(certificate);
    return new NextResponse(pdf, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${certificate.certificateNo}.pdf"`, "cache-control": "private, no-store" } });
  } catch {
    return new NextResponse("Warranty certificate unavailable", { status: 503 });
  }
}
