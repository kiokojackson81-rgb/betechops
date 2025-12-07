import { prisma } from '@/lib/prisma';
import puppeteer from 'puppeteer';
import sgMail from '@sendgrid/mail';
import Twilio from 'twilio';
import { getActorId } from '@/lib/api';
import { uploadBufferToS3 } from '@/lib/storage';
import renderReceiptTemplate from '@/app/templates/receiptTemplate';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

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

export async function generateReceiptPdf(receiptSnapshot: any): Promise<Buffer> {
  // Use branded template when available
  const html = renderReceiptTemplate(receiptSnapshot);
  const launchOptions: any = { args: ['--no-sandbox', '--disable-setuid-sandbox'] };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return pdf;
  } finally {
    try { await browser.close(); } catch {}
  }
}

export async function sendReceiptChannels(receiptId: string, channels: string[] = []) {
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId }, include: { order: { include: { items: true } }, issuedBy: true } });
  if (!receipt) throw new Error('Receipt not found');
  const snapshot = receipt.data ?? { order: receipt.order, totals: receipt.totals };

  // generate PDF
  const pdfBuffer = await generateReceiptPdf(snapshot);
  const sent: string[] = [];
  const errors: any[] = [];
  const actorId = (await getActorId()) || 'system';

  // upload to S3 (optional) so providers can attach media
  let pdfUrl: string | null = null;
  let s3Key: string | null = null;
  try {
    const bucket = process.env.S3_BUCKET;
    if (bucket) {
      const key = `receipts/${receipt.id}/receipt-${Date.now()}.pdf`;
      // retentionDays comes from env, optional
      const retentionDays = process.env.RECEIPT_RETENTION_DAYS ? Number(process.env.RECEIPT_RETENTION_DAYS) : undefined;
      pdfUrl = await uploadBufferToS3(bucket, key, pdfBuffer, 'application/pdf', retentionDays);
      s3Key = key;
    }
  } catch (e) {
    console.error('Failed to upload PDF to S3', e);
    errors.push({ channel: 's3', error: String(e) });
  }

  // Persist ReceiptFile record for audit and lifecycle
  try {
    const fileData: any = { receiptId: receipt.id, url: pdfUrl ?? (receipt.data as any)?.fileUrl ?? '', contentType: 'application/pdf', size: pdfBuffer.length, uploadedBy: actorId };
    if (s3Key) fileData.key = s3Key;
    const retentionDays = process.env.RECEIPT_RETENTION_DAYS ? Number(process.env.RECEIPT_RETENTION_DAYS) : undefined;
    if (retentionDays) fileData.expiresAt = new Date(Date.now() + retentionDays * 86400000);
    await prisma.receiptFile.create({ data: fileData });
  } catch (e) {
    console.error('Failed to create ReceiptFile record', e);
    errors.push({ channel: 'receiptFile.save', error: String(e) });
  }

  // Email via SendGrid
  try {
    const toEmail = (receipt.order as any)?.customerEmail || (receipt.data as any)?.customerEmail;
    const wantEmail = channels.length === 0 || channels.includes('email');
    if (wantEmail && toEmail && process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
      const msg: any = {
        to: toEmail,
        from: process.env.SENDGRID_FROM,
        subject: `Your receipt ${receipt.order?.orderNumber ?? receipt.id}`,
        text: `Please find your receipt attached.`,
        attachments: [{ content: pdfBuffer.toString('base64'), filename: `receipt-${receipt.id}.pdf`, type: 'application/pdf', disposition: 'attachment' }],
        // include link if available
        html: `<p>Please find your receipt attached.</p>${pdfUrl ? `<p><a href="${pdfUrl}">Download receipt (link)</a></p>` : ''}`,
      };
      await sgMail.send(msg);
      sent.push('email');
    }
  } catch (e) {
    errors.push({ channel: 'email', error: String(e) });
  }

  // WhatsApp / SMS via Twilio (send short link)
  try {
    const toPhone = (receipt.order as any)?.customerPhone || (receipt.data as any)?.customerPhone;
    const wantWhatsapp = channels.includes('whatsapp');
    const wantSms = channels.includes('sms');
    if ((wantWhatsapp || wantSms) && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_WHATSAPP) {
      const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const site = getSiteUrl();
      const link = `${site.replace(/\/$/, '')}/receipts/${receipt.id}`;
      if (toPhone) {
        if (wantWhatsapp) {
          // WhatsApp supports media via mediaUrl array if public URL available
          const msgPayload: any = { from: `whatsapp:${process.env.TWILIO_FROM_WHATSAPP}`, to: `whatsapp:${toPhone}`, body: `Your receipt: ${link}` };
          if (pdfUrl) msgPayload.mediaUrl = [pdfUrl];
          await client.messages.create(msgPayload);
          sent.push('whatsapp');
        }
        if (wantSms && process.env.TWILIO_FROM_SMS) {
          const smsPayload: any = { from: process.env.TWILIO_FROM_SMS, to: toPhone, body: `Your receipt: ${link}` };
          // some carriers support MMS attachments - if pdfUrl available, include link instead
          if (pdfUrl) smsPayload.mediaUrl = [pdfUrl];
          await client.messages.create(smsPayload);
          sent.push('sms');
        }
      }
    }
  } catch (e) {
    errors.push({ channel: 'twilio', error: String(e) });
  }

  // write audit log of send attempt
  try {
    await prisma.actionLog.create({ data: { actorId, entity: 'Receipt', entityId: receiptId, action: 'SEND', before: receipt as any, after: { sent, errors }, } });
  } catch (e) {
    // non-fatal
    console.error('Failed to write send action log', e);
  }

  return { ok: true, sent, errors };
}
