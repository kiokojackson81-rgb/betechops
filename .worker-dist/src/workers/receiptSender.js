"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReceiptPdf = generateReceiptPdf;
exports.sendReceiptChannels = sendReceiptChannels;
const prisma_1 = require("@/lib/prisma");
const puppeteer_1 = __importDefault(require("puppeteer"));
const mail_1 = __importDefault(require("@sendgrid/mail"));
const twilio_1 = __importDefault(require("twilio"));
const api_1 = require("@/lib/api");
const storage_1 = require("@/lib/storage");
const receiptTemplate_1 = __importDefault(require("@/app/templates/receiptTemplate"));
mail_1.default.setApiKey(process.env.SENDGRID_API_KEY || '');
function getSiteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://ops.betech.co.ke';
}
function renderHtml(snapshot) {
    const orderRef = snapshot.orderRef || snapshot.order?.orderNumber || '';
    const items = (snapshot.items || snapshot.order?.items || []).map((it) => {
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
async function generateReceiptPdf(receiptSnapshot) {
    // Use branded template when available
    const html = (0, receiptTemplate_1.default)(receiptSnapshot);
    const launchOptions = { args: ['--no-sandbox', '--disable-setuid-sandbox'] };
    if (process.env.PUPPETEER_EXECUTABLE_PATH)
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    const browser = await puppeteer_1.default.launch(launchOptions);
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        return pdf;
    }
    finally {
        try {
            await browser.close();
        }
        catch { }
    }
}
async function sendReceiptChannels(receiptId, channels = []) {
    const receipt = await prisma_1.prisma.receipt.findUnique({ where: { id: receiptId }, include: { order: { include: { items: true } }, issuedBy: true } });
    if (!receipt)
        throw new Error('Receipt not found');
    const snapshot = receipt.data ?? { order: receipt.order, totals: receipt.totals };
    // generate PDF
    const pdfBuffer = await generateReceiptPdf(snapshot);
    const sent = [];
    const errors = [];
    const actorId = (await (0, api_1.getActorId)()) || 'system';
    // upload to S3 (optional) so providers can attach media
    let pdfUrl = null;
    let s3Key = null;
    try {
        const bucket = process.env.S3_BUCKET;
        if (bucket) {
            const key = `receipts/${receipt.id}/receipt-${Date.now()}.pdf`;
            // retentionDays comes from env, optional
            const retentionDays = process.env.RECEIPT_RETENTION_DAYS ? Number(process.env.RECEIPT_RETENTION_DAYS) : undefined;
            pdfUrl = await (0, storage_1.uploadBufferToS3)(bucket, key, pdfBuffer, 'application/pdf', retentionDays);
            s3Key = key;
        }
    }
    catch (e) {
        console.error('Failed to upload PDF to S3', e);
        errors.push({ channel: 's3', error: String(e) });
    }
    // Persist ReceiptFile record for audit and lifecycle
    try {
        const fileData = { receiptId: receipt.id, url: pdfUrl ?? receipt.data?.fileUrl ?? '', contentType: 'application/pdf', size: pdfBuffer.length, uploadedBy: actorId };
        if (s3Key)
            fileData.key = s3Key;
        const retentionDays = process.env.RECEIPT_RETENTION_DAYS ? Number(process.env.RECEIPT_RETENTION_DAYS) : undefined;
        if (retentionDays)
            fileData.expiresAt = new Date(Date.now() + retentionDays * 86400000);
        await prisma_1.prisma.receiptFile.create({ data: fileData });
    }
    catch (e) {
        console.error('Failed to create ReceiptFile record', e);
        errors.push({ channel: 'receiptFile.save', error: String(e) });
    }
    // Email via SendGrid
    try {
        const toEmail = receipt.order?.customerEmail || receipt.data?.customerEmail;
        const wantEmail = channels.length === 0 || channels.includes('email');
        if (wantEmail && toEmail && process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
            const msg = {
                to: toEmail,
                from: process.env.SENDGRID_FROM,
                subject: `Your receipt ${receipt.order?.orderNumber ?? receipt.id}`,
                text: `Please find your receipt attached.`,
                attachments: [{ content: pdfBuffer.toString('base64'), filename: `receipt-${receipt.id}.pdf`, type: 'application/pdf', disposition: 'attachment' }],
                // include link if available
                html: `<p>Please find your receipt attached.</p>${pdfUrl ? `<p><a href="${pdfUrl}">Download receipt (link)</a></p>` : ''}`,
            };
            await mail_1.default.send(msg);
            sent.push('email');
        }
    }
    catch (e) {
        errors.push({ channel: 'email', error: String(e) });
    }
    // WhatsApp / SMS via Twilio (send short link)
    try {
        const toPhone = receipt.order?.customerPhone || receipt.data?.customerPhone;
        const wantWhatsapp = channels.includes('whatsapp');
        const wantSms = channels.includes('sms');
        if ((wantWhatsapp || wantSms) && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_WHATSAPP) {
            const client = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            const site = getSiteUrl();
            const link = `${site.replace(/\/$/, '')}/receipts/${receipt.id}`;
            if (toPhone) {
                if (wantWhatsapp) {
                    // WhatsApp supports media via mediaUrl array if public URL available
                    const msgPayload = { from: `whatsapp:${process.env.TWILIO_FROM_WHATSAPP}`, to: `whatsapp:${toPhone}`, body: `Your receipt: ${link}` };
                    if (pdfUrl)
                        msgPayload.mediaUrl = [pdfUrl];
                    await client.messages.create(msgPayload);
                    sent.push('whatsapp');
                }
                if (wantSms && process.env.TWILIO_FROM_SMS) {
                    const smsPayload = { from: process.env.TWILIO_FROM_SMS, to: toPhone, body: `Your receipt: ${link}` };
                    // some carriers support MMS attachments - if pdfUrl available, include link instead
                    if (pdfUrl)
                        smsPayload.mediaUrl = [pdfUrl];
                    await client.messages.create(smsPayload);
                    sent.push('sms');
                }
            }
        }
    }
    catch (e) {
        errors.push({ channel: 'twilio', error: String(e) });
    }
    // write audit log of send attempt
    try {
        await prisma_1.prisma.actionLog.create({ data: { actorId, entity: 'Receipt', entityId: receiptId, action: 'SEND', before: receipt, after: { sent, errors }, } });
    }
    catch (e) {
        // non-fatal
        console.error('Failed to write send action log', e);
    }
    return { ok: true, sent, errors };
}
