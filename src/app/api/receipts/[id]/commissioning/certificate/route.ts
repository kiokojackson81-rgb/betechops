import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { buildCommissioningCertificatePdf } from "@/lib/commissioningCertificate";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function GET(_request: Request, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;

  const { id } = await context.params;
  const session = await prisma.commissioningSession.findUnique({
    where: { receiptId: id },
    include: {
      technician: { select: { name: true } },
      receipt: {
        select: {
          receiptNumber: true,
          data: true,
          order: {
            select: {
              orderNumber: true,
              customerName: true,
              customerEmail: true,
              customerPhone: true,
              metadata: true,
            },
          },
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "No commissioning certificate was found for this project." }, { status: 404 });
  }
  if (session.status !== "ISSUED") {
    return NextResponse.json({ error: "Issue the commissioning certificate before downloading it." }, { status: 409 });
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
