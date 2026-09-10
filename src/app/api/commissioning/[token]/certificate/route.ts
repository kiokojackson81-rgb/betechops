import { NextResponse } from "next/server";
import { findAccessibleCommissioningSession } from "@/lib/commissioning";
import { buildCommissioningCertificatePdf } from "@/lib/commissioningCertificate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = {
  params: Promise<{ token: string }> | { token: string };
};

export async function GET(_request: Request, context: ParamsContext) {
  const { token } = await context.params;
  const session = await findAccessibleCommissioningSession(token);
  if (!session || session.status !== "ISSUED") {
    return new NextResponse("Certificate unavailable", { status: 404 });
  }

  const pdf = await buildCommissioningCertificatePdf(session);
  const filename = `${(session.certificateNo || "betech-completion-certificate").replace(/[^a-zA-Z0-9_-]+/g, "-")}.pdf`;
  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
