import { headers } from "next/headers";
import { z } from "zod";
import { absUrl } from "@/lib/abs-url";
import { getActorId, noStoreJson, requireRole } from "@/lib/api";
import {
  convertLppToPos,
  getLppAccountSummary,
  getSerializedLppAccountDetail,
} from "@/lib/lipaPolePoleService";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const maybePromise = (context as { params?: Promise<{ id: string }> | { id: string } }).params;
  if (maybePromise && typeof (maybePromise as Promise<{ id: string }>).then === "function") {
    return maybePromise as Promise<{ id: string }>;
  }
  return Promise.resolve((context as { params: { id: string } }).params);
}

const payloadSchema = z.object({
  shopId: z.string().trim().min(1).optional().nullable(),
});

function mapErrorStatus(message: string) {
  if (["RECEIPT_ID_REQUIRED", "LPP_BALANCE_NOT_ZERO", "LPP_NOT_CONVERTIBLE"].includes(message)) return 400;
  if (message === "LPP_NOT_FOUND") return 404;
  if (message === "LPP_ALREADY_CONVERTED") return 409;
  return 500;
}

export async function POST(req: Request, context: ParamsContext) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId =
    (auth.session?.user as { id?: string } | undefined)?.id ??
    (await getActorId());
  const { id } = await resolveParams(context);

  try {
    const summary = await getLppAccountSummary(id);
    if (summary.lpp.convertedReceiptId) {
      const detail = await getSerializedLppAccountDetail(id);
      return noStoreJson({ ok: true, receiptId: summary.lpp.convertedReceiptId, ...detail });
    }

    const serial = `SALE-${summary.lpp.reference}`;
    const customerName =
      await prisma.user.findUnique({
        where: { id: summary.lpp.customerId },
        select: { name: true, phone: true, email: true },
      });

    const receiptPayload = {
      serial,
      docType: "RECEIPT",
      shopId: parsed.data.shopId ?? undefined,
      customerName: customerName?.name || "LPP Customer",
      customerPhone: customerName?.phone ?? null,
      customerEmail: customerName?.email ?? null,
      issuedById: actorId ?? undefined,
      notes: `Converted from Lipa Pole Pole ${summary.lpp.reference}`,
      paymentDetailsShown: true,
      items: summary.items.map((item) => ({
        productId: item.productId ?? undefined,
        title: item.description,
        product: item.description,
        quantity: Number(item.quantity ?? 1),
        unitPrice: Number(item.unitPrice ?? 0),
        sellingPrice: Number(item.unitPrice ?? 0),
        serial: item.serial ?? null,
        warranty: item.warranty ?? null,
      })),
      metadata: {
        source: "LIPA_POLE_POLE",
        lppId: summary.lpp.id,
        lppReference: summary.lpp.reference,
        lppCustomerId: summary.lpp.customerId,
        lppPaymentTotal: completionSafeNumber(summary.summary.totalPaid),
        lppAgreedTotal: completionSafeNumber(summary.summary.agreedTotal),
      },
      link: true,
    };

    const incomingHeaders = await headers();
    const cookieHeader = incomingHeaders.get("cookie") ?? undefined;
    const receiptRes = await fetch(await absUrl("/api/receipts?link=1"), {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(receiptPayload),
    });
    const receiptData = (await receiptRes.json().catch(() => ({}))) as { receiptId?: string; message?: string; error?: string };
    if (!receiptRes.ok || !receiptData.receiptId) {
      throw new Error(receiptData.message || receiptData.error || "FAILED_TO_CREATE_POS_RECEIPT");
    }

    await convertLppToPos({
      lipaPolePoleId: id,
      receiptId: receiptData.receiptId,
      convertedById: actorId,
    });

    const detail = await getSerializedLppAccountDetail(id);
    return noStoreJson({ ok: true, receiptId: receiptData.receiptId, ...detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to convert LPP to POS";
    return noStoreJson({ error: message }, { status: mapErrorStatus(message) });
  }
}

function completionSafeNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}
