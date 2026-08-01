import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReceiptPdfResponse } from "@/lib/receiptPdfResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = { params: { token: string } } | { params: Promise<{ token: string }> };

async function resolveParams(context: ParamsContext): Promise<{ token: string }> {
  const params = (context as { params: Promise<{ token: string }> | { token: string } }).params;
  if (params && typeof (params as Promise<{ token: string }>).then === "function") {
    return params as Promise<{ token: string }>;
  }
  return Promise.resolve(params as { token: string });
}

export async function GET(req: NextRequest, context: ParamsContext) {
  const { token } = await resolveParams(context);
  const cleanedToken = String(token || "").trim();
  if (!cleanedToken) {
    return new Response("Invalid receipt link.", { status: 400 });
  }

  const receipt = await prisma.receipt.findFirst({
    where: {
      data: {
        path: ["publicReceiptToken"],
        equals: cleanedToken,
      },
    },
    select: { id: true, order: { select: { orderNumber: true } } },
  });

  if (!receipt) {
    return new Response("Receipt not found.", { status: 404 });
  }

  const asDownload = req.nextUrl.searchParams.get("download") === "1";
  const fileNamePrefix = `Betech-${receipt.order?.orderNumber || receipt.id}-Receipt`;
  return buildReceiptPdfResponse(receipt.id, { asDownload, allowCached: true, fileNamePrefix });
}

