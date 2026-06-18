import { NextRequest, NextResponse } from "next/server";
import { quoteRequestResponseSchema, getAssignedQuoteRequestById, requireQuoteRequestsStaffActor, updateQuoteRequestResponse } from "@/lib/quoteRequests";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { sendGeneralCustomerNotificationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function buildQuoteEmailBody(request: NonNullable<Awaited<ReturnType<typeof getAssignedQuoteRequestById>>>) {
  const quoteBits = [
    typeof request.quotationData?.batterySize === "string" && request.quotationData.batterySize
      ? `<li><strong>Battery size:</strong> ${request.quotationData.batterySize}</li>`
      : "",
    typeof request.quotationData?.inverterSize === "string" && request.quotationData.inverterSize
      ? `<li><strong>Inverter size:</strong> ${request.quotationData.inverterSize}</li>`
      : "",
    typeof request.quotationData?.panelSetup === "string" && request.quotationData.panelSetup
      ? `<li><strong>Solar panel setup:</strong> ${request.quotationData.panelSetup}</li>`
      : "",
    typeof request.quotationData?.accessories === "string" && request.quotationData.accessories
      ? `<li><strong>Accessories:</strong> ${request.quotationData.accessories}</li>`
      : "",
    typeof request.quotationData?.estimatedAmount === "string" && request.quotationData.estimatedAmount
      ? `<li><strong>Estimated amount:</strong> ${request.quotationData.estimatedAmount}</li>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const productsHtml =
    typeof request.quotationData?.recommendedProducts === "string" &&
    request.quotationData.recommendedProducts
      ? `<div style="margin-top:16px"><div style="font-size:13px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#7a0000;margin-bottom:8px">Recommended products</div><div style="font-size:15px;line-height:1.8;color:#334155;white-space:pre-wrap">${request.quotationData.recommendedProducts}</div></div>`
      : "";

  const quoteMessageHtml = request.quoteMessage
    ? `<div style="margin-top:16px;font-size:15px;line-height:1.85;color:#334155;white-space:pre-wrap">${request.quoteMessage}</div>`
    : "";

  return `
    <div style="font-size:15px;line-height:1.85;color:#334155">
      <p style="margin:0 0 12px">Hello ${request.customerName},</p>
      <p style="margin:0 0 12px">Your Betech Solar quotation request has been updated by our customer service team.</p>
      <div style="margin-top:18px;padding:18px;border:1px solid #f1e4d3;border-radius:18px;background:#fffdfa">
        <div style="font-size:13px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#7a0000;margin-bottom:10px">Quotation reference</div>
        <div style="font-size:20px;font-weight:800;color:#111827">${request.quoteRef}</div>
        ${request.quoteTitle ? `<div style="margin-top:12px;font-size:16px;font-weight:700;color:#111827">${request.quoteTitle}</div>` : ""}
        ${quoteMessageHtml}
        ${quoteBits ? `<ul style="margin:16px 0 0 20px;padding:0;color:#334155;font-size:15px;line-height:1.8">${quoteBits}</ul>` : ""}
        ${productsHtml}
      </div>
      <p style="margin:18px 0 0">Log in to your account using your email address or phone number to view your quotation follow-up anytime.</p>
    </div>
  `;
}

function buildQuoteEmailText(request: NonNullable<Awaited<ReturnType<typeof getAssignedQuoteRequestById>>>) {
  const lines = [
    `Hello ${request.customerName},`,
    "",
    "Your Betech Solar quotation request has been updated by our customer service team.",
    "",
    `Quotation reference: ${request.quoteRef}`,
  ];

  if (request.quoteTitle) lines.push(`Quotation title: ${request.quoteTitle}`);
  if (request.quoteMessage) lines.push("", request.quoteMessage);
  if (typeof request.quotationData?.batterySize === "string" && request.quotationData.batterySize) {
    lines.push(`Battery size: ${request.quotationData.batterySize}`);
  }
  if (typeof request.quotationData?.inverterSize === "string" && request.quotationData.inverterSize) {
    lines.push(`Inverter size: ${request.quotationData.inverterSize}`);
  }
  if (typeof request.quotationData?.panelSetup === "string" && request.quotationData.panelSetup) {
    lines.push(`Solar panel setup: ${request.quotationData.panelSetup}`);
  }
  if (typeof request.quotationData?.accessories === "string" && request.quotationData.accessories) {
    lines.push(`Accessories: ${request.quotationData.accessories}`);
  }
  if (typeof request.quotationData?.estimatedAmount === "string" && request.quotationData.estimatedAmount) {
    lines.push(`Estimated amount: ${request.quotationData.estimatedAmount}`);
  }
  if (
    typeof request.quotationData?.recommendedProducts === "string" &&
    request.quotationData.recommendedProducts
  ) {
    lines.push("", "Recommended products:", request.quotationData.recommendedProducts);
  }

  lines.push(
    "",
    "Log in with your phone number or email address at https://www.betech.co.ke/account to view your quotation follow-up anytime.",
  );

  return lines.join("\n");
}

function buildQuoteSms(request: NonNullable<Awaited<ReturnType<typeof getAssignedQuoteRequestById>>>) {
  const estimate =
    typeof request.quotationData?.estimatedAmount === "string" && request.quotationData.estimatedAmount
      ? ` Estimate: ${request.quotationData.estimatedAmount}.`
      : "";
  return `Hello ${request.customerName}, your Betech Solar quotation ${request.quoteRef} is ready.${estimate} Login with your phone number at https://www.betech.co.ke/account to view quote details. Call 0722151083 for help.`;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = quoteRequestResponseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid quotation response payload." }, { status: 400 });
  }

  const existing = await getAssignedQuoteRequestById(id, guard.userId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Quotation request not found." }, { status: 404 });
  }

  const updated = await updateQuoteRequestResponse(
    id,
    {
      id: guard.userId,
      name: guard.name,
      email: guard.email,
    },
    parsed.data,
  );

  if (!updated) {
    return NextResponse.json({ ok: false, error: "Unable to update quotation request." }, { status: 500 });
  }

  const notifications: Array<{ channel: "email" | "sms"; ok: boolean; error?: string }> = [];

  if (parsed.data.sendEmail && updated.customerEmail) {
    try {
      await sendGeneralCustomerNotificationEmail({
        to: updated.customerEmail,
        subject: `${updated.quoteTitle || "Your Betech Solar quotation"} • ${updated.quoteRef}`,
        title: updated.quoteTitle || "Your solar quotation is ready",
        intro: `Quotation reference: ${updated.quoteRef}`,
        bodyHtml: buildQuoteEmailBody(updated),
        bodyText: buildQuoteEmailText(updated),
        ctaLabel: "Login to your account",
        ctaUrl: "https://www.betech.co.ke/account",
        outro: "You can continue following up from your Betech account anytime.",
      });
      notifications.push({ channel: "email", ok: true });
    } catch (error) {
      notifications.push({
        channel: "email",
        ok: false,
        error: error instanceof Error ? error.message : "Failed to send email.",
      });
    }
  }

  if (parsed.data.sendSms && updated.customerPhone) {
    try {
      await sendTransactionalSms(updated.customerPhone, buildQuoteSms(updated));
      notifications.push({ channel: "sms", ok: true });
    } catch (error) {
      notifications.push({
        channel: "sms",
        ok: false,
        error: error instanceof Error ? error.message : "Failed to send SMS.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    request: updated,
    notifications,
  });
}
