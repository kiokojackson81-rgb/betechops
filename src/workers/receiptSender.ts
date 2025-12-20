import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import sgMail from '@sendgrid/mail';
import Twilio from 'twilio';
import { getActorId } from '@/lib/api';
import { uploadBufferToS3 } from '@/lib/storage';
import renderReceiptTemplate from '@/app/templates/receiptTemplate';
import { hasWhatsAppConfig, sendWhatsAppDocumentMessage, sendWhatsAppTextMessage } from '@/lib/notifications/whatsapp';
import { pushReceiptToChatrace } from '@/lib/integrations/chatrace';
import { normalizePhone } from '@/lib/phone';
import { launchChromiumBrowser } from '@/lib/pdf/chromium';
import { uploadReceiptPdfToBlob } from '@/lib/blob/uploadReceiptPdf';


function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://ops.betech.co.ke';
}

function formatMeta(meta?: Record<string, unknown>) {
  if (!meta) return '';
  const entries = Object.entries(meta).filter(([, value]) => value !== undefined);
  if (!entries.length) return '';
  return (
    ' ' +
    entries
      .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
      .join(' ')
  );
}

function logStep(requestId: string, step: string, status: string, meta?: Record<string, unknown>) {
  console.info(`[receiptSender][${requestId}] ${step}:${status}${formatMeta(meta)}`);
}

function formatCurrencyKes(value: number) {
  try {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${Math.round(value)} KES`;
  }
}

type WhatsAppMessageParams = {
  customerName?: string;
  receiptNumber: string;
  invoiceAmount: number;
  paymentMethod?: string;
  attendant?: string;
  items?: any[];
  receiptLink: string;
  pdfUrl?: string | null;
  siteTitle: string;
};

function buildWhatsAppMessage(params: WhatsAppMessageParams) {
  const {
    customerName,
    receiptNumber,
    invoiceAmount,
    paymentMethod,
    attendant,
    items = [],
    receiptLink,
    pdfUrl,
    siteTitle,
  } = params;

  const formattedTotal = formatCurrencyKes(invoiceAmount);
  const greeting = customerName ? `Hello ${customerName},` : 'Hello,';
  const itemLines = (items || [])
    .map((item) => {
      const title = item?.title || item?.productName || 'Item';
      const qty = Number.isFinite(Number(item?.quantity ?? 1)) ? Number(item?.quantity ?? 1) : 1;
      const unitPrice = Number.isFinite(Number(item?.unitPrice ?? item?.sellingPrice ?? 0))
        ? Number(item?.unitPrice ?? item?.sellingPrice ?? 0)
        : 0;
      const lineTotal = qty * unitPrice;
      const amountText = Number.isFinite(lineTotal) ? formatCurrencyKes(lineTotal) : '';
      return `${title} x${qty}${amountText ? ` (${amountText})` : ''}`;
    })
    .slice(0, 3);
  const itemsText =
    itemLines.length > 0
      ? `Items:\n${itemLines.join('\n')}${items.length > 3 ? `\n...and ${items.length - 3} more item(s)` : ''}`
      : '';
  const lines = [
    greeting,
    '',
    `Thank you for shopping at ${siteTitle}.`,
    '',
    'Your purchase details:',
    `Receipt Number: ${receiptNumber}`,
    `Total Amount: ${formattedTotal}`,
    paymentMethod ? `Payment Method: ${paymentMethod}` : null,
    attendant ? `Served by: ${attendant}` : null,
    itemsText || null,
    '',
    pdfUrl ? `Download your receipt: ${pdfUrl}` : `View your receipt: ${receiptLink}`,
    '',
    'We value your feedback. Share your experience with us on our social media pages.',
    `Thank you for choosing ${siteTitle}.`,
  ].filter(Boolean);
  return lines.join('\n');
}

export async function generateReceiptPdf(receiptSnapshot: any, opts: { hideStamp?: boolean } = {}): Promise<Buffer | null> {
  const html = renderReceiptTemplate(receiptSnapshot, { hideStamp: Boolean(opts.hideStamp) });
  let browser;
  try {
    browser = await launchChromiumBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return pdf;
  } catch (err) {
    console.error('[receiptSender] failed to render PDF', err);
    return null;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
  }
}

async function fetchPdfFromService(html: string): Promise<Buffer | null> {
  const url = process.env.PDF_SERVICE_URL;
  if (!url) return null;
  try {
    const res = await fetch(url.replace(/\/$/, '') + '/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html }),
    });
    if (!res.ok) {
      console.error('[receiptSender] pdf service responded with', res.status);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return buffer;
  } catch (err) {
    console.error('[receiptSender] failed to fetch pdf from service', err);
    return null;
  }
}

export async function sendReceiptChannels(
  receiptId: string,
  channels: string[] = [],
  opts?: { requestId?: string }
) {
  const requestId = opts?.requestId ?? randomUUID();
  const startTime = Date.now();
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { order: { include: { items: true, attendant: true } }, issuedBy: true },
  });
  if (!receipt) throw new Error('Receipt not found');
  const wantEmail = channels.length === 0 || channels.includes('email');
  const wantWhatsapp = channels.length === 0 || channels.includes('whatsapp');
  const wantSms = channels.length === 0 || channels.includes('sms');
  logStep(requestId, 'START', 'send_pipeline', { wantEmail, wantWhatsapp, wantSms });
  // Normalize receipt.data into a mutable object for template rendering and metadata additions.
  // `receipt.data` is a Prisma JsonValue (could be string/number/etc) so narrow it to an object first.
  const snapshot: any = typeof receipt.data === 'object' && receipt.data ? { ...(receipt.data as Record<string, unknown>) } : { order: receipt.order, totals: receipt.totals };
  if (!snapshot.attendantName) {
    snapshot.attendantName = receipt.order?.attendant?.name ?? receipt.issuedBy?.name;
  }

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

  // Only attempt PDF rendering when the environment explicitly allows it
  // or when a puppeteer executable path is provided. This prevents noisy
  // runtime errors in serverless environments that do not include Chromium
  // (e.g. Vercel serverless functions) and lets us fall back to sending
  // the receipt page link instead.
  const canRenderPdf = process.env.NODE_ENV === 'test' || Boolean(process.env.PUPPETEER_EXECUTABLE_PATH) || process.env.ENABLE_PDF_RENDERING === '1';
  if (!canRenderPdf) {
    console.warn('[receiptSender] PDF rendering disabled in this environment; will use receipt link fallback');
  }
  const needsPdf = canRenderPdf && Boolean(process.env.S3_BUCKET || wantEmail || wantWhatsapp);
  let pdfCustomerBuffer: Buffer | null = null;
  let pdfFullBuffer: Buffer | null = null;
  if (needsPdf) {
    logStep(requestId, 'PDF', 'begin');
    // If a remote PDF service is configured, prefer it. Otherwise fall back
    // to local puppeteer rendering.
    const pdfServiceUrl = process.env.PDF_SERVICE_URL;
    if (pdfServiceUrl) {
      try {
        const htmlCustomer = renderReceiptTemplate(snapshot, { hideStamp: true });
        pdfCustomerBuffer = await fetchPdfFromService(htmlCustomer);
      } catch (err) {
        console.error('[receiptSender] pdf service customer render exception', err);
      }
      try {
        const htmlFull = renderReceiptTemplate(snapshot, { hideStamp: false });
        pdfFullBuffer = await fetchPdfFromService(htmlFull);
      } catch (err) {
        console.error('[receiptSender] pdf service full render exception', err);
      }
    } else {
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
    }
    const anyGenerated = Boolean(pdfCustomerBuffer || pdfFullBuffer);
    channelStatus.pdf = anyGenerated ? 'generated' : 'failed';
    logStep(requestId, 'PDF', anyGenerated ? 'ok' : 'failed', {
      bytes_customer: pdfCustomerBuffer?.length ?? 0,
      bytes_full: pdfFullBuffer?.length ?? 0,
      reason: anyGenerated ? undefined : 'generation_failed',
    });
    if (!anyGenerated) {
      errors.push({ channel: 'pdf', error: 'Customer PDF generation failed' });
    }
  } else {
    channelStatus.pdf = 'skipped';
    logStep(requestId, 'PDF', 'skipped');
  }

  // upload generated PDFs (prefer Vercel Blob, fall back to S3)
  let pdfUrlCustomer: string | null = null;
  let pdfUrlFull: string | null = null;
  let pdfKeyCustomer: string | null = null;
  let pdfKeyFull: string | null = null;
  const retentionDays = process.env.RECEIPT_RETENTION_DAYS ? Number(process.env.RECEIPT_RETENTION_DAYS) : undefined;
  try {
    logStep(requestId, 'BLOB', 'begin');
    const blobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
    let uploadedAny = false;

    if (blobToken && (pdfCustomerBuffer?.length || pdfFullBuffer?.length)) {
      if (pdfCustomerBuffer?.length) {
        try {
          const uploaded = await uploadReceiptPdfToBlob({ receiptId: receipt.id, kind: 'customer', buffer: pdfCustomerBuffer });
          pdfUrlCustomer = uploaded.url;
          pdfKeyCustomer = uploaded.key;
          uploadedAny = true;
          console.info('[pdf][blob] customer uploaded', {
            receiptId: receipt.id,
            key: pdfKeyCustomer,
            urlLength: pdfUrlCustomer.length,
            size: pdfCustomerBuffer.length,
          });
        } catch (blobErr) {
          console.error('[pdf][blob] customer upload failed; will fall back to receipt link', {
            receiptId: receipt.id,
            error: blobErr instanceof Error ? blobErr.message : String(blobErr),
          });
        }
      }
      if (pdfFullBuffer?.length) {
        try {
          const uploaded = await uploadReceiptPdfToBlob({ receiptId: receipt.id, kind: 'print', buffer: pdfFullBuffer });
          pdfUrlFull = uploaded.url;
          pdfKeyFull = uploaded.key;
          uploadedAny = true;
          console.info('[pdf][blob] print uploaded', {
            receiptId: receipt.id,
            key: pdfKeyFull,
            urlLength: pdfUrlFull.length,
            size: pdfFullBuffer.length,
          });
        } catch (blobErr) {
          console.error('[pdf][blob] print upload failed; will fall back to receipt link', {
            receiptId: receipt.id,
            error: blobErr instanceof Error ? blobErr.message : String(blobErr),
          });
        }
      }
    }

    if (!uploadedAny) {
      const bucket = process.env.S3_BUCKET;
      if (bucket && (pdfCustomerBuffer || pdfFullBuffer)) {
        const keyCust = `receipts/${receipt.id}/receipt-customer-${Date.now()}.pdf`;
        const keyFull = `receipts/${receipt.id}/receipt-full-${Date.now()}.pdf`;
        if (pdfCustomerBuffer) {
          pdfUrlCustomer = await uploadBufferToS3(bucket, keyCust, pdfCustomerBuffer, 'application/pdf', retentionDays);
          pdfKeyCustomer = keyCust;
        }
        if (pdfFullBuffer) {
          pdfUrlFull = await uploadBufferToS3(bucket, keyFull, pdfFullBuffer, 'application/pdf', retentionDays);
          pdfKeyFull = keyFull;
        }
        uploadedAny = Boolean(pdfUrlCustomer || pdfUrlFull);
      }
    }

    channelStatus.pdfUpload = uploadedAny ? 'uploaded' : 'skipped';
    logStep(requestId, 'BLOB', uploadedAny ? 'ok' : 'skipped', {
      url_customer: pdfUrlCustomer,
      url_full: pdfUrlFull,
      uploadedAny,
    });
  } catch (e) {
    console.error('Failed to upload PDF to storage', e);
    errors.push({ channel: 'pdfUpload', error: String(e) });
    channelStatus.pdfUpload = 'failed';
    logStep(requestId, 'BLOB', 'failed', { error: String(e) });
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

  // For Chatrace: pdfUrlForChatrace is the S3 PDF (may be null).
  // We will always send `receipt_link` and only send `pdf_url` when S3 PDF exists.
  // Call Chatrace whenever we have a normalized phone number; the payload
  // will include `receiptLink` and optionally `pdfUrl`.
  const chatracePdfUrl = pdfUrlForChatrace; // may be null

  if (normalizedChatracePhone) {
    logStep(requestId, 'CHARTRACE', 'begin', { phone: normalizedChatracePhone, pdfUrl: !!pdfUrlForChatrace });
    try {
      // structured log about env presence and inputs
      const tagName = 'receipt_created';

      console.info('[receipts][chatrace] preparing push', {
        receiptId: receipt.id,
        phoneNormalized: normalizedChatracePhone,
        pdfUrlPresent: !!pdfUrlForChatrace,
        pdfUrlLength: pdfUrlForChatrace?.length ?? 0,
        CHATRACE_BASE_URL: !!process.env.CHATRACE_BASE_URL,
        CHATRACE_ACCOUNT_ID: !!process.env.CHATRACE_ACCOUNT_ID,
        tokenPresent: !!process.env.CHATRACE_API_TOKEN,
        tagName,
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
        receiptLink: receiptPageLink,
        pdfUrl: chatracePdfUrl ?? undefined,
        tagName,
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
      logStep(requestId, 'CHARTRACE', result?.ok ? 'ok' : 'failed', {
        contactCreated: result?.debug?.contactId,
        tagName,
        pdfUrl: !!pdfUrlForChatrace,
        receiptLink: receiptPageLink.length,
      });

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
    logStep(requestId, 'CHARTRACE', 'skipped');
  }

  // Persist ReceiptFile record for audit and lifecycle
  try {
    // create separate records for customer and full PDFs (if available)
    const retentionDays = process.env.RECEIPT_RETENTION_DAYS ? Number(process.env.RECEIPT_RETENTION_DAYS) : undefined;
    const hasNonEmptyUrl = (u?: string | null) => typeof u === 'string' && u.trim().length > 0;

    if (hasNonEmptyUrl(pdfUrlCustomer)) {
      const fileDataCust: any = {
        receiptId: receipt.id,
        key: pdfKeyCustomer ?? undefined,
        url: pdfUrlCustomer!,
        contentType: 'application/pdf',
        size: pdfCustomerBuffer?.length ?? undefined,
        uploadedBy: actorId ?? undefined,
        expiresAt: retentionDays ? new Date(Date.now() + retentionDays * 86400000) : undefined,
      };
      await prisma.receiptFile.create({ data: fileDataCust });
    } else {
      console.warn('[receiptSender] skipping ReceiptFile.create for customer PDF: missing url', {
        receiptId: receipt.id,
        pdfUrlCustomerPresent: hasNonEmptyUrl(pdfUrlCustomer),
        pdfKeyCustomerPresent: !!pdfKeyCustomer,
        bufferLen: pdfCustomerBuffer?.length ?? 0,
      });
    }

    if (hasNonEmptyUrl(pdfUrlFull)) {
      const fileDataFull: any = {
        receiptId: receipt.id,
        key: pdfKeyFull ?? undefined,
        url: pdfUrlFull!,
        contentType: 'application/pdf',
        size: pdfFullBuffer?.length ?? undefined,
        uploadedBy: actorId ?? undefined,
        expiresAt: retentionDays ? new Date(Date.now() + retentionDays * 86400000) : undefined,
      };
      await prisma.receiptFile.create({ data: fileDataFull });
    } else {
      console.warn('[receiptSender] skipping ReceiptFile.create for full PDF: missing url', {
        receiptId: receipt.id,
        pdfUrlFullPresent: hasNonEmptyUrl(pdfUrlFull),
        pdfKeyFullPresent: !!pdfKeyFull,
        bufferLen: pdfFullBuffer?.length ?? 0,
      });
    }
  } catch (e) {
    console.error('Failed to create ReceiptFile record', e);
    errors.push({ channel: 'receiptFile.save', error: String(e) });
  }

  // Email via SendGrid
  try {
    const toEmail = (receipt.order as any)?.customerEmail || (receipt.data as any)?.customerEmail;
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
        console.warn('[receiptSender] sendgrid_missing_env');
        channelStatus.email = 'skipped';
        logStep(requestId, 'EMAIL', 'skipped', { reason: 'missing_sendgrid' });
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
          logStep(requestId, 'EMAIL', 'ok', { to: toEmail });
        } catch (emailErr) {
          channelStatus.email = 'failed';
          errors.push({ channel: 'email', error: emailErr instanceof Error ? emailErr.message : String(emailErr) });
          logStep(requestId, 'EMAIL', 'failed', { error: emailErr instanceof Error ? emailErr.message : String(emailErr) });
        }
      }
    } else {
      channelStatus.email = wantEmail ? 'missing-recipient' : 'not-requested';
      const reason = wantEmail ? 'missing_recipient' : 'not_requested';
      logStep(requestId, 'EMAIL', reason);
    }
  } catch (e) {
    channelStatus.email = 'failed';
    errors.push({ channel: 'email', error: String(e) });
    logStep(requestId, 'EMAIL', 'failed', { error: String(e) });
  }

  // WhatsApp via Meta Business API or Twilio fallback + optional SMS
  try {
    const orderAny = receipt.order as any;
    const dataAny = (receipt.data as any) || {};
    const toPhone = (orderAny?.customerPhone || dataAny?.customerPhone || '').trim();
    if (!wantWhatsapp) channelStatus.whatsapp = 'skipped';
    if (!wantSms) channelStatus.sms = 'skipped';
    const site = getSiteUrl();
    const link = `${site.replace(/\/$/, '')}/receipts/${receipt.id}`;

    // Prefer authoritative values from `receipt.order` when available, then fall back
    // to `receipt.data` (snapshot) and finally issuedBy or defaults. Also log sources
    // so we can diagnose mismatches between what was entered and what is sent.
    const customerName = orderAny?.customerName ?? dataAny?.customerName ?? snapshot.customerName ?? receipt.issuedBy?.name ?? 'Customer';
    const whatsappAttendant = snapshot.attendantName ?? orderAny?.attendant?.name ?? receipt.issuedBy?.name;
    const snapshotData = snapshot as Record<string, any>;
    const receiptItems = orderAny?.items ?? snapshotData.items ?? [];
    const paymentMethodText = orderAny?.paymentMethod ?? snapshotData.paymentMethod ?? undefined;

    console.info('[receiptSender][whatsapp] composing message', {
      receiptId: receipt.id,
      orderNumber: orderAny?.orderNumber ?? null,
      toPhone,
      phoneFrom: orderAny?.customerPhone ? 'order' : dataAny?.customerPhone ? 'data' : 'none',
      customerNameSource: orderAny?.customerName ? 'order' : dataAny?.customerName ? 'data' : snapshot.customerName ? 'snapshot' : 'issuedBy',
      customerName,
      paymentMethod: paymentMethodText,
      itemsCount: Array.isArray(receiptItems) ? receiptItems.length : 0,
    });

    const whatsappMessage = buildWhatsAppMessage({
      customerName,
      receiptNumber: orderAny?.orderNumber ?? receipt.id,
      invoiceAmount,
      paymentMethod: paymentMethodText,
      attendant: whatsappAttendant,
      items: receiptItems,
      receiptLink: link,
      pdfUrl: pdfUrlCustomer,
      siteTitle: process.env.RECEIPT_SITE_TITLE || 'Betech Solar Solutions',
    });

    if (wantWhatsapp && toPhone) {
      if (hasWhatsAppConfig()) {
        try {
          if (pdfUrlCustomer) {
            await sendWhatsAppDocumentMessage({
              to: toPhone,
              link: pdfUrlCustomer,
              filename: `receipt-${receipt.id}.pdf`,
              caption: whatsappMessage,
            });
          } else {
            // fallback to sending a text link
            await sendWhatsAppTextMessage({
              to: toPhone,
              body: whatsappMessage,
              previewUrl: true,
            });
          }
          sent.push('whatsapp');
          channelStatus.whatsapp = 'sent';
          logStep(requestId, 'WHATSAPP', 'ok', { to: toPhone, provider: 'meta' });
        } catch (err) {
          channelStatus.whatsapp = 'failed';
          errors.push({ channel: 'whatsapp', error: err instanceof Error ? err.message : String(err) });
          logStep(requestId, 'WHATSAPP', 'failed', { error: err instanceof Error ? err.message : String(err) });
        }
      } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_WHATSAPP) {
        const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const msgPayload: any = {
          from: `whatsapp:${process.env.TWILIO_FROM_WHATSAPP}`,
          to: `whatsapp:${toPhone}`,
          body: whatsappMessage,
        };
        if (pdfUrlCustomer) msgPayload.mediaUrl = [pdfUrlCustomer];
        await client.messages.create(msgPayload);
        sent.push('whatsapp');
        channelStatus.whatsapp = 'sent';
        logStep(requestId, 'WHATSAPP', 'ok', { to: toPhone, provider: 'twilio' });
      } else {
        channelStatus.whatsapp = 'failed';
        errors.push({ channel: 'whatsapp', error: 'No WhatsApp provider configured' });
        logStep(requestId, 'WHATSAPP', 'failed', { reason: 'no_provider' });
      }
    } else if (wantWhatsapp && !toPhone) {
      channelStatus.whatsapp = 'missing-phone';
      logStep(requestId, 'WHATSAPP', 'failed', { reason: 'missing_phone' });
    }

    if (wantSms) {
      if (toPhone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_SMS) {
        const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const smsPayload: any = { from: process.env.TWILIO_FROM_SMS, to: toPhone, body: `Your receipt: ${link}` };
        if (pdfUrlCustomer) smsPayload.mediaUrl = [pdfUrlCustomer];
        await client.messages.create(smsPayload);
        sent.push('sms');
        channelStatus.sms = 'sent';
        logStep(requestId, 'SMS', 'ok', { to: toPhone });
      } else {
        channelStatus.sms = 'failed';
        errors.push({ channel: 'sms', error: 'SMS provider not configured or missing phone' });
        logStep(requestId, 'SMS', 'failed', { reason: 'missing_provider_or_phone' });
      }
    }
  } catch (e) {
    if (channelStatus.whatsapp === 'pending') channelStatus.whatsapp = 'failed';
    if (channelStatus.sms === 'pending') channelStatus.sms = 'failed';
    errors.push({ channel: 'twilio', error: String(e) });
    logStep(requestId, 'SEND', 'failed', { error: String(e) });
  }

  // write audit log of send attempt
  try {
    await prisma.actionLog.create({ data: { actorId, entity: 'Receipt', entityId: receiptId, action: 'SEND', before: receipt as any, after: { sent, errors }, } });
  } catch (e) {
    // non-fatal
    console.error('Failed to write send action log', e);
  }

  const ok = errors.length === 0;
  const durationMs = Date.now() - startTime;
  logStep(requestId, 'END', ok ? 'ok' : 'failed', {
    durationMs,
    channelStatus: JSON.stringify(channelStatus),
    errors: errors.length,
  });
  return { ok, sent, errors, channelStatus, pdfUrlCustomer, pdfUrlFull, pdfKeyCustomer, pdfKeyFull };
}
