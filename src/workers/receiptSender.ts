import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import sgMail from '@sendgrid/mail';
import Twilio from 'twilio';
import { getActorId } from '@/lib/api';
import { uploadBufferToS3 } from '@/lib/storage';
import renderReceiptTemplate from '@/app/templates/receiptTemplate';
import { hasWhatsAppConfig, sendWhatsAppDocumentMessage, sendWhatsAppTextMessage } from '@/lib/notifications/whatsapp';
import { pushReceiptToChatrace } from '@/lib/integrations/chatrace';
import { normalizePhone } from '@/lib/phone';


function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://ops.betech.co.ke';
}

function renderHtml(snapshot: any) {
  const orderRef = snapshot.orderRef || snapshot.order?.orderNumber || '';
  const items = (snapshot.items || snapshot.order?.items || []).map((it: any) => {
    return `<tr><td>${(it.title || it.productName || '')}</td><td>${it.quantity ?? 1}</td><td>${it.unitPrice ?? it.sellingPrice ?? ''}</td><td>${it.serial ?? ''}</td><td>${it.warranty ?? ''}</td></tr>`;
  }).join('');

  return `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Receipt ${orderRef}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 6px; }
      th { background: #f4f4f4; }
    </style>
  </head>
  <body>
    <h2>Receipt ${orderRef}</h2>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Serial</th><th>Warranty</th></tr></thead>
      <tbody>${items}</tbody>
    </table>
    <p>Total: ${(snapshot.totals?.total ?? snapshot.order?.totalAmount ?? '')}</p>
  </body>
  </html>
  `;
}

export async function generateReceiptPdf(receiptSnapshot: any, opts: { hideStamp?: boolean } = {}): Promise<Buffer | null> {
  // Use branded template when available. opts.hideStamp=true produces a soft copy without stamp/signature.
  const html = renderReceiptTemplate(receiptSnapshot, { hideStamp: Boolean(opts.hideStamp) });
  const launchOptions: any = {
    args: chromium.args,
  };
  const defaultViewport = (chromium as any).defaultViewport;
  if (defaultViewport) launchOptions.defaultViewport = defaultViewport;
  const headlessFlag = (chromium as any).headless;
  launchOptions.headless = typeof headlessFlag === 'boolean' ? headlessFlag : true;
  try {
    const executablePath = await chromium.executablePath();
    launchOptions.executablePath = executablePath;
    console.info('[receiptSender] launching Chromium', { executablePath });
  } catch (err) {
    console.error('[receiptSender] failed to resolve Chromium executable', err);
    return null;
  }
  try {
    const browser = await puppeteer.launch(launchOptions);
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      return pdf;
    } finally {
      try { await browser.close(); } catch {}
    }
  } catch (err) {
    console.error('[receiptSender] failed to render PDF', err);
    return null;
  }
}

export async function sendReceiptChannels(receiptId: string, channels: string[] = []) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { order: { include: { items: true } }, issuedBy: true },
  });
  if (!receipt) throw new Error('Receipt not found');
  const wantEmail = channels.length === 0 || channels.includes('email');
  const wantWhatsapp = channels.includes('whatsapp');
  const wantSms = channels.includes('sms');
  const snapshot = receipt.data ?? { order: receipt.order, totals: receipt.totals };

  const sent: string[] = [];
  const errors: any[] = [];
  const channelStatus = {
    pdf: 'pending',
    pdfUpload: 'pending',
    email: 'pending',
    whatsapp: 'pending',
    sms: 'pending',
    chatrace: 'pending',
  };
  const actorId = (await getActorId()) || 'system';

  const needsPdf = Boolean(process.env.S3_BUCKET || wantEmail);
  let pdfCustomerBuffer: Buffer | null = null;
  let pdfFullBuffer: Buffer | null = null;
  if (needsPdf) {
    try {
      pdfCustomerBuffer = await generateReceiptPdf(snapshot, { hideStamp: true });
    } catch (err) {
      console.error('[receiptSender] customer PDF generation exception', err);
    }
    try {
      pdfFullBuffer = await generateReceiptPdf(snapshot, { hideStamp: false });
    } catch (err) {
      console.error('[receiptSender] full PDF generation exception', err);
    }
    const anyGenerated = Boolean(pdfCustomerBuffer || pdfFullBuffer);
    channelStatus.pdf = anyGenerated ? 'generated' : 'failed';
    if (!anyGenerated) {
      errors.push({ channel: 'pdf', error: 'Customer PDF generation failed' });
    }
  } else {
    channelStatus.pdf = 'skipped';
  }

  // upload to S3 (optional) so providers can attach media
  // upload both customer and full PDFs if S3 configured
  let pdfUrlCustomer: string | null = null;
  let pdfUrlFull: string | null = null;
  let s3KeyCustomer: string | null = null;
  let s3KeyFull: string | null = null;
  try {
    const bucket = process.env.S3_BUCKET;
    if (bucket && (pdfCustomerBuffer || pdfFullBuffer)) {
      const keyCust = `receipts/${receipt.id}/receipt-customer-${Date.now()}.pdf`;
      const keyFull = `receipts/${receipt.id}/receipt-full-${Date.now()}.pdf`;
      const retentionDays = process.env.RECEIPT_RETENTION_DAYS ? Number(process.env.RECEIPT_RETENTION_DAYS) : undefined;
      if (pdfCustomerBuffer) {
        pdfUrlCustomer = await uploadBufferToS3(bucket, keyCust, pdfCustomerBuffer, 'application/pdf', retentionDays);
        s3KeyCustomer = keyCust;
      }
      if (pdfFullBuffer) {
        pdfUrlFull = await uploadBufferToS3(bucket, keyFull, pdfFullBuffer, 'application/pdf', retentionDays);
        s3KeyFull = keyFull;
      }
      channelStatus.pdfUpload = 'uploaded';
    } else {
      channelStatus.pdfUpload = 'skipped';
    }
  } catch (e) {
    console.error('Failed to upload PDF to S3', e);
    errors.push({ channel: 's3', error: String(e) });
    channelStatus.pdfUpload = 'failed';
  }

  const pdfUrlForChatrace = pdfUrlCustomer ?? pdfUrlFull;
  const rawCustomerPhone =
    ((receipt.order as any)?.customerPhone ?? (receipt.data as any)?.customerPhone ?? "")
      .toString()
      .trim();
  const normalizedChatracePhone = normalizePhone(rawCustomerPhone);
  const totals = typeof receipt.totals === "object" && receipt.totals ? (receipt.totals as Record<string, unknown>) : null;
  const totalField = totals?.total;
  const numericTotal =
    typeof totalField === "number"
      ? totalField
      : typeof totalField === "string"
      ? Number(totalField)
      : NaN;
  const invoiceAmount = Number.isFinite(numericTotal)
    ? numericTotal
    : typeof receipt.order?.totalAmount === "number"
    ? receipt.order.totalAmount
    : 0;
  const getChatraceMetaUpdate = async (updates: Record<string, unknown>) => {
    const baseData =
      typeof receipt.data === "object" && receipt.data
        ? { ...(receipt.data as Record<string, unknown>) }
        : {};
    const existingChatrace =
      typeof baseData.chatrace === "object" && baseData.chatrace
        ? { ...(baseData.chatrace as Record<string, unknown>) }
        : {};
    const nextData = { ...baseData, chatrace: { ...existingChatrace, ...updates } };
    try {
      await prisma.receipt.update({ where: { id: receipt.id }, data: { data: nextData as Prisma.InputJsonValue } });
    } catch (updateErr) {
      console.error('[receipts][chatrace] failed to persist metadata', updateErr);
    }
  };

  const site = getSiteUrl();
  const receiptPageLink = `${site.replace(/\/$/, '')}/receipts/${receipt.id}`;

  if (!pdfUrlForChatrace) {
    console.warn('[receipts][chatrace] no PDF URL available for receipt, will fall back to receipt page link', { receiptId: receipt.id, receiptPageLink });
  }

  // Use PDF URL when available, otherwise fall back to the receipt page link so Chatrace still receives a link.
  const chatracePdfUrl = pdfUrlForChatrace ?? receiptPageLink;

  if (chatracePdfUrl && normalizedChatracePhone) {
    try {
      // structured log about env presence and inputs
      console.info('[receipts][chatrace] preparing push', {
        receiptId: receipt.id,
        phoneNormalized: normalizedChatracePhone,
        pdfUrlPresent: !!pdfUrlForChatrace,
        pdfUrlLength: pdfUrlForChatrace?.length ?? 0,
        CHATRACE_BASE_URL: !!process.env.CHATRACE_BASE_URL,
        CHATRACE_ACCOUNT_ID: !!process.env.CHATRACE_ACCOUNT_ID,
        tokenPresent: !!process.env.CHATRACE_API_TOKEN,
        tagName: 'receipt_created',
      });

      const chitInput = {
        phoneE164: normalizedChatracePhone,
        customerName:
          (receipt.order as any)?.customerName ??
          (receipt.data as any)?.customerName ??
          "Customer",
        receiptNumber: receipt.order?.orderNumber ?? receipt.id,
        amount: Math.round(invoiceAmount).toString(),
        currency: "KES",
        pdfUrl: chatracePdfUrl,
      };

      const result = await pushReceiptToChatrace(chitInput);
      channelStatus.chatrace = result?.ok ? 'sent' : 'failed';
      if (!result?.ok) {
        errors.push({
          channel: 'chatrace',
          error: result?.debug?.error ?? 'Chatrace push failed',
        });
      }
      console.info('[receipts][chatrace] push result', { receiptId: receipt.id, ok: !!result?.ok, steps: result?.debug?.steps });

      // persist summary into receipt.data.chatrace
      await getChatraceMetaUpdate({
        status: result?.ok ? "sent" : "failed",
        lastSentAt: result?.ok ? new Date().toISOString() : undefined,
        lastAttemptAt: result?.ok ? undefined : new Date().toISOString(),
        pdfUrl: pdfUrlForChatrace,
        receiptNumber: receipt.order?.orderNumber ?? receipt.id,
        debug: result?.debug,
      });

      // Diagnostic: if this is the problematic receipt id, surface full debug
      if (receipt.id === 'Betech-20251218-21941') {
        console.error('[receipts][chatrace][DIAGNOSTIC] full debug', { receiptId: receipt.id, debug: result?.debug });
      }
    } catch (chErr) {
      const message = chErr instanceof Error ? chErr.message : String(chErr);
      // Diagnostic mode: for named receipt, log full error
      if (receipt.id === 'Betech-20251218-21941') {
        console.error('[receipts][chatrace][DIAGNOSTIC] unexpected error', chErr);
      } else {
        console.error(`[receipts][chatrace] failed to push receipt ${receipt.id}`, message);
      }
      channelStatus.chatrace = 'failed';
      await getChatraceMetaUpdate({
        status: "failed",
        lastAttemptAt: new Date().toISOString(),
        lastError: message,
      });
      // TODO: schedule a background retry job for receipts with chatrace.status=failed
    }
  } else {
    channelStatus.chatrace = 'skipped';
  }

  // Persist ReceiptFile record for audit and lifecycle
  try {
    // create separate records for customer and full PDFs (if available)
    const retentionDays = process.env.RECEIPT_RETENTION_DAYS ? Number(process.env.RECEIPT_RETENTION_DAYS) : undefined;
    if (pdfUrlCustomer || pdfCustomerBuffer) {
      const fileDataCust: any = {
        receiptId: receipt.id,
        url: pdfUrlCustomer ?? '',
        contentType: 'application/pdf',
        size: pdfCustomerBuffer?.length ?? 0,
        uploadedBy: actorId,
        tag: 'customer',
      };
      if (s3KeyCustomer) fileDataCust.key = s3KeyCustomer;
      if (retentionDays) fileDataCust.expiresAt = new Date(Date.now() + retentionDays * 86400000);
      await prisma.receiptFile.create({ data: fileDataCust });
    }
    if (pdfUrlFull || pdfFullBuffer) {
      const fileDataFull: any = {
        receiptId: receipt.id,
        url: pdfUrlFull ?? '',
        contentType: 'application/pdf',
        size: pdfFullBuffer?.length ?? 0,
        uploadedBy: actorId,
        tag: 'print',
      };
      if (s3KeyFull) fileDataFull.key = s3KeyFull;
      if (retentionDays) fileDataFull.expiresAt = new Date(Date.now() + retentionDays * 86400000);
      await prisma.receiptFile.create({ data: fileDataFull });
    }
  } catch (e) {
    console.error('Failed to create ReceiptFile record', e);
    errors.push({ channel: 'receiptFile.save', error: String(e) });
  }

  // Email via SendGrid
  try {
    const toEmail = (receipt.order as any)?.customerEmail || (receipt.data as any)?.customerEmail;
    const wantEmail = channels.length === 0 || channels.includes('email');
    const rawSendgridKey = process.env.SENDGRID_API_KEY || process.env.SENDGRID_KEY || '';
    const sendgridEnv = process.env.SENDGRID_API_KEY
      ? 'SENDGRID_API_KEY'
      : process.env.SENDGRID_KEY
      ? 'SENDGRID_KEY'
      : 'none';
    const maskedKey = rawSendgridKey ? `***${rawSendgridKey.slice(-4)}` : 'none';
    console.info('[receiptSender] SendGrid config', { sendgridEnv, key: maskedKey });
    const hasValidSendgrid = rawSendgridKey.startsWith('SG.') && Boolean(process.env.SENDGRID_FROM);

    if (wantEmail && toEmail) {
      if (!hasValidSendgrid) {
        console.warn('[receiptSender] SendGrid disabled (missing/invalid key)');
        channelStatus.email = 'skipped';
      } else {
        try {
          sgMail.setApiKey(rawSendgridKey);
          const attachmentBuffer = pdfCustomerBuffer ?? Buffer.from('');
          const msg: any = {
            to: toEmail,
            from: process.env.SENDGRID_FROM,
            subject: `Your receipt ${receipt.order?.orderNumber ?? receipt.id}`,
            text: `Please find your receipt attached.`,
            attachments: attachmentBuffer.length
              ? [{ content: attachmentBuffer.toString('base64'), filename: `receipt-${receipt.id}.pdf`, type: 'application/pdf', disposition: 'attachment' }]
              : [],
            html: `<p>Please find your receipt attached.</p>${pdfUrlCustomer ? `<p><a href="${pdfUrlCustomer}">Download receipt (link)</a></p>` : ''}`,
          };
          await sgMail.send(msg);
          sent.push('email');
          channelStatus.email = 'sent';
        } catch (emailErr) {
          channelStatus.email = 'failed';
          errors.push({ channel: 'email', error: emailErr instanceof Error ? emailErr.message : String(emailErr) });
        }
      }
    } else {
      channelStatus.email = wantEmail ? 'missing-recipient' : 'not-requested';
    }
  } catch (e) {
    channelStatus.email = 'failed';
    errors.push({ channel: 'email', error: String(e) });
  }

  // WhatsApp via Meta Business API or Twilio fallback + optional SMS
  try {
    const toPhone = ((receipt.order as any)?.customerPhone || (receipt.data as any)?.customerPhone || '').trim();
    if (!wantWhatsapp) channelStatus.whatsapp = 'skipped';
    if (!wantSms) channelStatus.sms = 'skipped';
    const site = getSiteUrl();
    const link = `${site.replace(/\/$/, '')}/receipts/${receipt.id}`;

    if (wantWhatsapp && toPhone) {
      if (hasWhatsAppConfig()) {
        try {
          if (pdfUrlCustomer) {
            await sendWhatsAppDocumentMessage({
              to: toPhone,
              link: pdfUrlCustomer,
              filename: `receipt-${receipt.id}.pdf`,
              caption: `Receipt ${receipt.order?.orderNumber ?? receipt.id}`,
            });
          } else {
            // fallback to sending a text link
            await sendWhatsAppTextMessage({
              to: toPhone,
              body: `Your receipt ${receipt.order?.orderNumber ?? ''}: ${link}`,
              previewUrl: true,
            });
          }
          sent.push('whatsapp');
          channelStatus.whatsapp = 'sent';
        } catch (err) {
          channelStatus.whatsapp = 'failed';
          errors.push({ channel: 'whatsapp', error: err instanceof Error ? err.message : String(err) });
        }
      } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_WHATSAPP) {
        const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const msgPayload: any = { from: `whatsapp:${process.env.TWILIO_FROM_WHATSAPP}`, to: `whatsapp:${toPhone}`, body: `Your receipt: ${link}` };
          if (pdfUrlCustomer) msgPayload.mediaUrl = [pdfUrlCustomer];
        await client.messages.create(msgPayload);
        sent.push('whatsapp');
        channelStatus.whatsapp = 'sent';
      } else {
        channelStatus.whatsapp = 'failed';
        errors.push({ channel: 'whatsapp', error: 'No WhatsApp provider configured' });
      }
    } else if (wantWhatsapp && !toPhone) {
      channelStatus.whatsapp = 'missing-phone';
    }

    if (wantSms) {
      if (toPhone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_SMS) {
        const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const smsPayload: any = { from: process.env.TWILIO_FROM_SMS, to: toPhone, body: `Your receipt: ${link}` };
        if (pdfUrlCustomer) smsPayload.mediaUrl = [pdfUrlCustomer];
        await client.messages.create(smsPayload);
        sent.push('sms');
        channelStatus.sms = 'sent';
      } else {
        channelStatus.sms = 'failed';
        errors.push({ channel: 'sms', error: 'SMS provider not configured or missing phone' });
      }
    }
  } catch (e) {
    if (channelStatus.whatsapp === 'pending') channelStatus.whatsapp = 'failed';
    if (channelStatus.sms === 'pending') channelStatus.sms = 'failed';
    errors.push({ channel: 'twilio', error: String(e) });
  }

  // write audit log of send attempt
  try {
    await prisma.actionLog.create({ data: { actorId, entity: 'Receipt', entityId: receiptId, action: 'SEND', before: receipt as any, after: { sent, errors }, } });
  } catch (e) {
    // non-fatal
    console.error('Failed to write send action log', e);
  }

  const ok = errors.length === 0;
  return { ok, sent, errors, channelStatus };
}
