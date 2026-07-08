import { NextRequest, NextResponse } from "next/server";
import {
  quoteRequestResponseSchema,
  getAssignedQuoteRequestById,
  getQuoteRequestById,
  requireQuoteRequestsStaffActor,
  updateQuoteRequestResponse,
} from "@/lib/quoteRequests";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { sendGeneralCustomerNotificationEmail } from "@/lib/email";
import {
  formatQuoteCurrency,
  getQuotePaymentMethodLabel,
  getQuotePaymentTermsLabel,
  parseStoredQuoteProposal,
} from "@/lib/quoteProposal";
import { buildQuoteProposalPdfBuffer } from "@/lib/quoteProposalPdf";

export const dynamic = "force-dynamic";

function buildItemsHtml(
  items: ReturnType<typeof parseStoredQuoteProposal>["items"],
) {
  if (!items.length) return "";

  return `
    <div style="margin-top:18px">
      <div style="display:inline-block;margin:0 0 12px;padding:8px 14px;border-radius:999px;background:#fff7e7;color:#7a0000;font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase">Items quoted</div>
      <div style="border:1px solid #f1e4d3;border-radius:18px;overflow:hidden;background:#fffdfa">
        ${items
          .map(
            (item, index) => `
              <div style="${index ? "border-top:1px solid #f1e4d3;" : ""}">
                <div style="padding:14px 16px;background:#fffdf8">
                  <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#7a0000;margin-bottom:6px">Item name</div>
                  <div style="font-size:16px;line-height:1.7;font-weight:700;color:#111827">${item.itemName}</div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:12px 16px;border-top:1px solid #f7ead8">
                  <div>
                    <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#7a0000;margin-bottom:4px">Quantity</div>
                    <div style="font-size:14px;color:#1f2937">${item.quantity}</div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#7a0000;margin-bottom:4px">Unit price</div>
                    <div style="font-size:14px;color:#1f2937">${formatQuoteCurrency(item.unitPrice)}</div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#7a0000;margin-bottom:4px">Total</div>
                    <div style="font-size:14px;font-weight:800;color:#111827">${formatQuoteCurrency(item.lineTotal)}</div>
                  </div>
                </div>
              </div>`,
          )
          .join("")}
      </div>
    </div>
  `;
}

function buildItemsText(
  items: ReturnType<typeof parseStoredQuoteProposal>["items"],
) {
  if (!items.length) return "";

  return [
    "Items quoted:",
    ...items.map(
      (item) =>
        `- Item name: ${item.itemName}\n  Quantity: ${item.quantity}\n  Unit price: ${formatQuoteCurrency(item.unitPrice)}\n  Total: ${formatQuoteCurrency(item.lineTotal)}`,
    ),
  ].join("\n");
}

function buildPaymentHtml(proposal: ReturnType<typeof parseStoredQuoteProposal>) {
  const paymentMethodLabel = getQuotePaymentMethodLabel(proposal.paymentMethod);
  const paymentTermsLabel = getQuotePaymentTermsLabel(proposal.paymentTerms);

  return `
    <div style="margin-top:18px;padding:18px;border:1px solid #f1e4d3;border-radius:18px;background:#fffdfa">
      <div style="display:inline-block;margin:0 0 12px;padding:8px 14px;border-radius:999px;background:#fff7e7;color:#7a0000;font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase">Payment options</div>
      <div style="font-size:15px;line-height:1.8;color:#334155">
        <div><strong>Preferred payment method:</strong> ${paymentMethodLabel}</div>
        <div><strong>Payment terms:</strong> ${paymentTermsLabel}</div>
        ${
          proposal.paymentTerms === "DEPOSIT_AND_BALANCE"
            ? `<div><strong>Deposit:</strong> ${formatQuoteCurrency(proposal.depositAmount)}</div>
               <div><strong>Balance:</strong> ${formatQuoteCurrency(proposal.balanceAmount)}</div>`
            : ""
        }
        <div style="margin-top:12px"><strong>Total quotation amount:</strong> <span style="font-size:19px;font-weight:800;color:#111827">${formatQuoteCurrency(proposal.total)}</span></div>
      </div>
    </div>
  `;
}

function buildPaymentText(proposal: ReturnType<typeof parseStoredQuoteProposal>) {
  const lines = [
    `Preferred payment method: ${getQuotePaymentMethodLabel(proposal.paymentMethod)}`,
    `Payment terms: ${getQuotePaymentTermsLabel(proposal.paymentTerms)}`,
    `Total quotation amount: ${formatQuoteCurrency(proposal.total)}`,
  ];
  if (proposal.paymentTerms === "DEPOSIT_AND_BALANCE") {
    lines.push(`Deposit: ${formatQuoteCurrency(proposal.depositAmount)}`);
    lines.push(`Balance: ${formatQuoteCurrency(proposal.balanceAmount)}`);
  }
  return lines.join("\n");
}

function buildQuoteEmailBody(request: NonNullable<Awaited<ReturnType<typeof getAssignedQuoteRequestById>>>) {
  const proposal = parseStoredQuoteProposal(request.quotationData);
  return `
    <div style="font-size:15px;line-height:1.85;color:#334155">
      <p style="margin:0 0 12px">Hello ${request.customerName},</p>
      <p style="margin:0 0 12px">Thank you for your interest in <strong>Betech Solar Solutions</strong>.</p>
      <p style="margin:0 0 18px">Our quotations team has reviewed your request and prepared your quotation. You can see the main details below, and the full quotation PDF is attached to this email.</p>

      <div style="padding:18px;border:1px solid #f1e4d3;border-radius:18px;background:#fffdfa">
        <div style="display:inline-block;margin:0 0 12px;padding:8px 14px;border-radius:999px;background:#fff7e7;color:#7a0000;font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase">Quotation summary</div>
        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="width:100%;border-collapse:collapse">
          ${[
            ["Quotation reference", request.quoteRef],
            ["Quote title", request.quoteTitle || "Betech Solar quotation"],
            ["Phone", request.customerPhone || "-"],
            ["Email", request.customerEmail || "-"],
            ["Location", request.customerLocation || [request.town, request.county].filter(Boolean).join(", ") || "-"],
            ["Subtotal", formatQuoteCurrency(proposal.subtotal)],
            ["Total", formatQuoteCurrency(proposal.total)],
          ]
            .map(
              ([label, value], index, rows) => `<tr>
                <td style="padding:12px 10px 12px 0;vertical-align:top;font-size:14px;font-weight:800;color:#7a0000;${
                  index === rows.length - 1 ? "" : "border-bottom:1px solid #f7ead8;"
                }">${label}:</td>
                <td style="padding:12px 0 12px 10px;vertical-align:top;font-size:15px;color:#1f2937;text-align:right;${
                  index === rows.length - 1 ? "" : "border-bottom:1px solid #f7ead8;"
                }">${value}</td>
              </tr>`,
            )
            .join("")}
        </table>
      </div>

      ${buildItemsHtml(proposal.items)}
      ${buildPaymentHtml(proposal)}

      ${
        request.quoteMessage
          ? `<div style="margin-top:18px;padding:18px;border:1px solid #f1e4d3;border-radius:18px;background:#fffdfa">
               <div style="display:inline-block;margin:0 0 12px;padding:8px 14px;border-radius:999px;background:#fff7e7;color:#7a0000;font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase">Quotation note</div>
               <div style="font-size:15px;line-height:1.85;color:#334155;white-space:pre-wrap">${request.quoteMessage}</div>
             </div>`
          : ""
      }

      <div style="margin-top:18px;padding:18px;border:1px solid #f1e4d3;border-radius:18px;background:#fffdfa">
        <div style="display:inline-block;margin:0 0 12px;padding:8px 14px;border-radius:999px;background:#fff7e7;color:#7a0000;font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase">Account portal</div>
        <p style="margin:0 0 12px">Login to your account using your <strong>email address or phone number</strong> to view your quotation details and download your quotation anytime.</p>
        <div><a href="https://www.betech.co.ke/account">https://www.betech.co.ke/account</a></div>
      </div>
    </div>
  `;
}

function buildQuoteEmailText(request: NonNullable<Awaited<ReturnType<typeof getAssignedQuoteRequestById>>>) {
  const proposal = parseStoredQuoteProposal(request.quotationData);
  return [
    `Hello ${request.customerName},`,
    "",
    "Thank you for your interest in Betech Solar Solutions.",
    "Our quotations team has reviewed your request and prepared your quotation. The full quotation PDF is attached to this email.",
    "",
    `Quotation reference: ${request.quoteRef}`,
    `Quote title: ${request.quoteTitle || "Betech Solar quotation"}`,
    `Phone: ${request.customerPhone || "-"}`,
    `Email: ${request.customerEmail || "-"}`,
    `Location: ${request.customerLocation || [request.town, request.county].filter(Boolean).join(", ") || "-"}`,
    `Subtotal: ${formatQuoteCurrency(proposal.subtotal)}`,
    `Total: ${formatQuoteCurrency(proposal.total)}`,
    "",
    buildItemsText(proposal.items),
    "",
    buildPaymentText(proposal),
    request.quoteMessage ? `\nQuotation note:\n${request.quoteMessage}\n` : "",
    "Login to your account using your email address or phone number to view your quotation details and download your quotation anytime.",
    "https://www.betech.co.ke/account",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildQuoteSms(request: NonNullable<Awaited<ReturnType<typeof getAssignedQuoteRequestById>>>) {
  const proposal = parseStoredQuoteProposal(request.quotationData);
  const totalAmount = formatQuoteCurrency(proposal.total);
  const depositText =
    proposal.paymentTerms === "DEPOSIT_AND_BALANCE" && proposal.depositAmount
      ? ` Deposit: ${formatQuoteCurrency(proposal.depositAmount)}. Balance: ${formatQuoteCurrency(
          proposal.balanceAmount,
        )}.`
      : "";
  return `Hello ${request.customerName}, your Betech Solar quotation ${request.quoteRef} is ready. Total: ${totalAmount}.${depositText} Login with your phone number at https://www.betech.co.ke/account to view quotation details and download the quotation. Call 0722151083 for help.`;
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

  const existing =
    guard.isElevatedActor && !request.nextUrl.searchParams.get("impersonateId")
      ? await getQuoteRequestById(id)
      : await getAssignedQuoteRequestById(id, guard.userId);
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

  const proposal = parseStoredQuoteProposal(updated.quotationData);
  const quotationPdf = await buildQuoteProposalPdfBuffer({
    quoteRef: updated.quoteRef,
    quoteTitle: updated.quoteTitle || "Betech Solar quotation",
    customerName: updated.customerName,
    customerPhone: updated.customerPhone,
    customerEmail: updated.customerEmail,
    customerLocation:
      updated.customerLocation || [updated.town, updated.county].filter(Boolean).join(", ") || null,
    issuedAtLabel: new Date().toLocaleString("en-KE"),
    items: proposal.items,
    subtotal: proposal.subtotal,
    total: proposal.total,
    paymentMethod: proposal.paymentMethod,
    paymentTerms: proposal.paymentTerms,
    deliveryMode: proposal.deliveryMode,
    installationMode: proposal.installationMode,
    depositAmount: proposal.depositAmount,
    balanceAmount: proposal.balanceAmount,
    quoteMessage: updated.quoteMessage,
    warrantyMode: proposal.warrantyMode,
    fullSystemWarranty: proposal.fullSystemWarranty,
    customWarranty: proposal.customWarranty,
    warrantyGeneralNotes: proposal.warrantyGeneralNotes,
    aiWarrantySummary: proposal.aiWarrantySummary,
    proposalSections: proposal.proposalSections,
    proposalVisibility: proposal.proposalVisibility,
  });

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
        attachments: [
          {
            filename: `${updated.quoteRef}.pdf`,
            content: quotationPdf,
            contentType: "application/pdf",
          },
        ],
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
