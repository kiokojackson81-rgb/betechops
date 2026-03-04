"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReceiptPdf = generateReceiptPdf;
exports.sendReceiptChannels = sendReceiptChannels;
const crypto_1 = require("crypto");
const prisma_1 = require("@/lib/prisma");
const mail_1 = __importDefault(require("@sendgrid/mail"));
const twilio_1 = __importDefault(require("twilio"));
const api_1 = require("@/lib/api");
const storage_1 = require("@/lib/storage");
const receiptTemplate_1 = __importDefault(require("@/app/templates/receiptTemplate"));
const chatrace_1 = require("@/lib/integrations/chatrace");
const phone_1 = require("@/lib/phone");
const chromium_1 = require("@/lib/pdf/chromium");
const uploadReceiptPdf_1 = require("@/lib/blob/uploadReceiptPdf");
const branding_1 = require("@/lib/branding");
function getSiteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://ops.betech.co.ke';
}
function formatMeta(meta) {
    if (!meta)
        return '';
    const entries = Object.entries(meta).filter(([, value]) => value !== undefined);
    if (!entries.length)
        return '';
    return (' ' +
        entries
            .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
            .join(' '));
}
function logStep(requestId, step, status, meta) {
    console.info(`[receiptSender][${requestId}] ${step}:${status}${formatMeta(meta)}`);
}
function formatCurrencyKes(value) {
    try {
        return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(value);
    }
    catch {
        return `${Math.round(value)} KES`;
    }
}
function buildWhatsAppMessage(params) {
    const { customerName, receiptNumber, invoiceAmount, paymentMethod, attendant, items = [], receiptLink, pdfUrl, siteTitle, } = params;
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
    const itemsText = itemLines.length > 0
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
const PDF_MIN_BYTES = 5000;
const DEBUG_HTML_SIGNATURE = process.env.DEBUG_RECEIPT_HTML === '1';
function logHtmlSignature(label, html) {
    if (!DEBUG_HTML_SIGNATURE)
        return;
    console.info('[receiptSender] html signature', {
        label,
        htmlLen: html.length,
        htmlHead: html.slice(0, 80),
        hasTable: html.includes('<table'),
        hasFooter: html.includes('Thank you for choosing'),
    });
}
function isPdfBuffer(buffer) {
    if (!buffer || buffer.length < 5)
        return false;
    // Check bytes for "%PDF-"
    return (buffer[0] === 0x25 && // %
        buffer[1] === 0x50 && // P
        buffer[2] === 0x44 && // D
        buffer[3] === 0x46 && // F
        buffer[4] === 0x2d // -
    );
}
function sanitizePdfBuffer(buffer, label) {
    if (!buffer)
        return null;
    if (!isPdfBuffer(buffer)) {
        const head = buffer.slice(0, Math.min(16, buffer.length));
        console.error('[receiptSender] rejecting invalid PDF buffer', {
            label,
            length: buffer.length,
            headAscii: head.toString('utf8'),
            headHex: head.toString('hex'),
        });
        return null;
    }
    return buffer;
}
async function generateReceiptPdf(receiptSnapshot, opts = {}) {
    // Prefer branding already present on the snapshot (caller-provided) to avoid
    // reading from a different DB/context; fall back to `getBranding()`.
    const branding = receiptSnapshot?.branding ?? (await (0, branding_1.getBranding)());
    const html = (0, receiptTemplate_1.default)({ ...receiptSnapshot, branding }, { hideStamp: Boolean(opts.hideStamp), hideItemWarrantySummary: true });
    logHtmlSignature(opts.htmlLabel ?? (opts.hideStamp ? 'pdf-stamp' : 'pdf-full'), html);
    let browser;
    try {
        browser = await (0, chromium_1.launchChromiumBrowser)();
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        return pdf;
    }
    catch (err) {
        console.error('[receiptSender] failed to render PDF', err);
        return null;
    }
    finally {
        if (browser) {
            try {
                await browser.close();
            }
            catch {
                // ignore
            }
        }
    }
}
async function fetchPdfFromService(html) {
    const url = process.env.PDF_SERVICE_URL;
    if (!url)
        return null;
    const endpoint = `${url.replace(/\/$/, '')}/render`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html }),
            signal: controller.signal,
        });
        const contentType = res.headers.get('content-type') || '';
        const contentLength = res.headers.get('content-length') || '';
        if (!res.ok) {
            const textSnippet = await res.text().catch(() => '');
            console.error('[receiptSender] pdf service responded with non-OK', {
                status: res.status,
                contentType,
                contentLength,
                responseSnippet: textSnippet.slice(0, 200),
            });
            return null;
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        const head = buffer.slice(0, Math.min(32, buffer.length)).toString('utf8');
        if (!isPdfBuffer(buffer)) {
            console.error('[receiptSender] pdf service returned invalid/suspicious PDF', {
                status: res.status,
                contentType,
                contentLength,
                bufferLength: buffer.length,
                bufferHead: head,
            });
            return null;
        }
        return buffer;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[receiptSender] failed to fetch pdf from service', { endpoint, error: message });
        return null;
    }
    finally {
        clearTimeout(timeout);
    }
}
async function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function isUrlReachable(url, tries = 3) {
    for (let i = 0; i < tries; i += 1) {
        const cacheBust = i > 0 ? (url.includes('?') ? `&_cb=${Date.now()}` : `?_cb=${Date.now()}`) : '';
        const target = `${url}${cacheBust}`;
        try {
            // Try HEAD first
            let headRes = null;
            try {
                headRes = await fetch(target, { method: 'HEAD' });
                if (headRes.ok) {
                    console.info('[receiptSender] isUrlReachable: HEAD ok', { url: target, status: headRes.status });
                    return true;
                }
                console.info('[receiptSender] isUrlReachable: HEAD returned', { url: target, status: headRes.status });
            }
            catch (headErr) {
                console.info('[receiptSender] isUrlReachable: HEAD failed', { url: target, error: headErr instanceof Error ? headErr.message : String(headErr) });
            }
            // If HEAD failed or returned 403/405, try GET with Range
            try {
                const getRes = await fetch(target, { method: 'GET', headers: { Range: 'bytes=0-0' } });
                if (getRes.ok || getRes.status === 206) {
                    console.info('[receiptSender] isUrlReachable: GET(range) ok', { url: target, status: getRes.status });
                    return true;
                }
                console.info('[receiptSender] isUrlReachable: GET(range) returned', { url: target, status: getRes.status });
            }
            catch (getErr) {
                console.info('[receiptSender] isUrlReachable: GET(range) failed', { url: target, error: getErr instanceof Error ? getErr.message : String(getErr) });
            }
        }
        catch {
            // ignore outer errors
        }
        await wait(400 * (i + 1));
    }
    return false;
}
async function isPdfUrlAccessible(url) {
    if (!url)
        return false;
    return isUrlReachable(url);
}
async function resolveChatracePdfUrl(site, receiptId, candidate) {
    const cleanCandidate = candidate?.trim();
    const proxyUrl = `${site.replace(/\/$/, '')}/api/receipts/${receiptId}/pdf`;
    if (cleanCandidate) {
        const candidateOk = await isUrlReachable(cleanCandidate, 3);
        if (candidateOk) {
            return { receiptUrl: cleanCandidate, mode: 'pdf' };
        }
        console.warn('[receiptSender] chatrace pdf url unreachable; trying proxy', { receiptId, candidate: cleanCandidate });
    }
    try {
        const proxyOk = await isUrlReachable(proxyUrl, 3);
        if (proxyOk) {
            return { receiptUrl: proxyUrl, mode: 'proxy' };
        }
        console.warn('[receiptSender] proxy pdf endpoint not reachable', { receiptId, proxyUrl });
    }
    catch (err) {
        console.warn('[receiptSender] error checking proxy pdf endpoint', { receiptId, error: err instanceof Error ? err.message : String(err) });
    }
    return { receiptUrl: null, mode: 'link' };
}
async function sendReceiptChannels(receiptId, channels = [], opts) {
    const requestId = opts?.requestId ?? (0, crypto_1.randomUUID)();
    const startTime = Date.now();
    const receipt = await prisma_1.prisma.receipt.findUnique({
        where: { id: receiptId },
        include: { order: { include: { items: true, attendant: true } }, issuedBy: true },
    });
    if (!receipt)
        throw new Error('Receipt not found');
    const wantEmail = channels.length === 0 || channels.includes('email');
    const wantWhatsapp = channels.length === 0 || channels.includes('whatsapp');
    const wantSms = channels.length === 0 || channels.includes('sms');
    logStep(requestId, 'START', 'send_pipeline', { wantEmail, wantWhatsapp, wantSms });
    // Normalize receipt.data into a mutable object for template rendering and metadata additions.
    // `receipt.data` is a Prisma JsonValue (could be string/number/etc) so narrow it to an object first.
    const snapshot = typeof receipt.data === 'object' && receipt.data
        ? { ...receipt.data }
        : { order: receipt.order, totals: receipt.totals };
    const branding = await (0, branding_1.getBranding)();
    if (!snapshot.attendantName) {
        snapshot.attendantName = receipt.order?.attendant?.name ?? receipt.issuedBy?.name;
    }
    snapshot.branding = branding;
    const brandedSnapshot = { ...snapshot, branding };
    const sent = [];
    const errors = [];
    const channelStatus = {
        pdf: 'pending',
        pdfUpload: 'pending',
        email: 'pending',
        whatsapp: 'pending',
        sms: 'pending',
        chatrace: 'pending',
    };
    const actorId = await (0, api_1.getActorId)();
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
    let pdfCustomerBuffer = null;
    let pdfFullBuffer = null;
    if (needsPdf) {
        logStep(requestId, 'PDF', 'begin');
        // If a remote PDF service is configured, prefer it. Otherwise fall back
        // to local puppeteer rendering.
        const pdfServiceUrl = process.env.PDF_SERVICE_URL;
        console.info('[receiptSender] pdf renderer config', {
            hasPdfService: Boolean(pdfServiceUrl),
            canRenderPdf,
            needsPdf,
        });
        if (pdfServiceUrl) {
            try {
                const htmlCustomer = (0, receiptTemplate_1.default)(brandedSnapshot, {
                    hideStamp: true,
                    hideItemWarrantySummary: true,
                });
                logHtmlSignature('customer-service', htmlCustomer);
                pdfCustomerBuffer = sanitizePdfBuffer(await fetchPdfFromService(htmlCustomer), 'customer-service');
            }
            catch (err) {
                console.error('[receiptSender] pdf service customer render exception', err);
            }
            try {
                const htmlFull = (0, receiptTemplate_1.default)(brandedSnapshot, {
                    hideStamp: false,
                    hideItemWarrantySummary: true,
                });
                logHtmlSignature('full-service', htmlFull);
                pdfFullBuffer = sanitizePdfBuffer(await fetchPdfFromService(htmlFull), 'full-service');
            }
            catch (err) {
                console.error('[receiptSender] pdf service full render exception', err);
            }
        }
        else {
            try {
                pdfCustomerBuffer = sanitizePdfBuffer(await generateReceiptPdf(brandedSnapshot, {
                    hideStamp: true,
                    htmlLabel: 'customer-local',
                }), 'customer-local');
            }
            catch (err) {
                console.error('[receiptSender] customer PDF generation exception', err);
            }
            try {
                pdfFullBuffer = sanitizePdfBuffer(await generateReceiptPdf(brandedSnapshot, {
                    hideStamp: false,
                    htmlLabel: 'full-local',
                }), 'full-local');
            }
            catch (err) {
                console.error('[receiptSender] full PDF generation exception', err);
            }
        }
        const anyGenerated = Boolean(pdfCustomerBuffer || pdfFullBuffer);
        channelStatus.pdf = anyGenerated ? 'generated' : 'failed';
        // Additional debug: log presence, sizes, and first bytes (hex) of generated PDFs
        const headHex = (buf, len = 8) => (buf ? buf.slice(0, Math.min(len, buf.length)).toString('hex') : null);
        console.info('[receiptSender] pdf generation summary', {
            receiptId: receipt.id,
            customerPdfPresent: !!pdfCustomerBuffer,
            customerPdfBytes: pdfCustomerBuffer?.length ?? 0,
            customerPdfHeadHex: headHex(pdfCustomerBuffer),
            fullPdfPresent: !!pdfFullBuffer,
            fullPdfBytes: pdfFullBuffer?.length ?? 0,
            fullPdfHeadHex: headHex(pdfFullBuffer),
        });
        logStep(requestId, 'PDF', anyGenerated ? 'ok' : 'failed', {
            bytes_customer: pdfCustomerBuffer?.length ?? 0,
            bytes_full: pdfFullBuffer?.length ?? 0,
            reason: anyGenerated ? undefined : 'generation_failed',
        });
        if (!anyGenerated) {
            errors.push({ channel: 'pdf', error: 'Customer PDF generation failed' });
        }
    }
    else {
        channelStatus.pdf = 'skipped';
        logStep(requestId, 'PDF', 'skipped');
    }
    // upload generated PDFs (prefer Vercel Blob, fall back to S3)
    let pdfUrlCustomer = null;
    let pdfUrlFull = null;
    let pdfKeyCustomer = null;
    let pdfKeyFull = null;
    const retentionDays = process.env.RECEIPT_RETENTION_DAYS ? Number(process.env.RECEIPT_RETENTION_DAYS) : undefined;
    try {
        logStep(requestId, 'BLOB', 'begin');
        const blobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
        let uploadedAny = false;
        if (blobToken && (pdfCustomerBuffer?.length || pdfFullBuffer?.length)) {
            if (pdfCustomerBuffer?.length) {
                try {
                    const uploaded = await (0, uploadReceiptPdf_1.uploadReceiptPdfToBlob)({ receiptId: receipt.id, kind: 'customer', buffer: pdfCustomerBuffer });
                    pdfUrlCustomer = uploaded.url;
                    pdfKeyCustomer = uploaded.key;
                    uploadedAny = true;
                    console.info('[pdf][blob] customer uploaded', {
                        receiptId: receipt.id,
                        key: pdfKeyCustomer,
                        url: pdfUrlCustomer,
                        size: pdfCustomerBuffer.length,
                    });
                    // Immediately verify blob URL with HEAD, fallback to GET range if HEAD fails
                    try {
                        const headRes = await fetch(pdfUrlCustomer, { method: 'HEAD' });
                        console.info('[pdf][blob] HEAD check', { receiptId: receipt.id, url: pdfUrlCustomer, status: headRes.status, contentType: headRes.headers.get('content-type'), contentLength: headRes.headers.get('content-length'), cacheControl: headRes.headers.get('cache-control') });
                        if (!headRes.ok && (headRes.status === 403 || headRes.status === 405)) {
                            const getRes = await fetch(pdfUrlCustomer, { method: 'GET', headers: { Range: 'bytes=0-0' } });
                            console.info('[pdf][blob] GET(range) check (HEAD returned 403/405)', { receiptId: receipt.id, url: pdfUrlCustomer, status: getRes.status, contentType: getRes.headers.get('content-type'), contentLength: getRes.headers.get('content-length'), cacheControl: getRes.headers.get('cache-control') });
                        }
                    }
                    catch (checkErr) {
                        console.warn('[pdf][blob] verification request failed', { receiptId: receipt.id, url: pdfUrlCustomer, error: checkErr instanceof Error ? checkErr.message : String(checkErr) });
                    }
                }
                catch (blobErr) {
                    console.error('[pdf][blob] customer upload failed; will fall back to receipt link', {
                        receiptId: receipt.id,
                        error: blobErr instanceof Error ? blobErr.message : String(blobErr),
                    });
                }
            }
            if (pdfFullBuffer?.length) {
                try {
                    const uploaded = await (0, uploadReceiptPdf_1.uploadReceiptPdfToBlob)({ receiptId: receipt.id, kind: 'print', buffer: pdfFullBuffer });
                    pdfUrlFull = uploaded.url;
                    pdfKeyFull = uploaded.key;
                    uploadedAny = true;
                    console.info('[pdf][blob] print uploaded', {
                        receiptId: receipt.id,
                        key: pdfKeyFull,
                        url: pdfUrlFull,
                        size: pdfFullBuffer.length,
                    });
                    try {
                        const headRes = await fetch(pdfUrlFull, { method: 'HEAD' });
                        console.info('[pdf][blob] HEAD check', { receiptId: receipt.id, url: pdfUrlFull, status: headRes.status, contentType: headRes.headers.get('content-type'), contentLength: headRes.headers.get('content-length'), cacheControl: headRes.headers.get('cache-control') });
                        if (!headRes.ok && (headRes.status === 403 || headRes.status === 405)) {
                            const getRes = await fetch(pdfUrlFull, { method: 'GET', headers: { Range: 'bytes=0-0' } });
                            console.info('[pdf][blob] GET(range) check (HEAD returned 403/405)', { receiptId: receipt.id, url: pdfUrlFull, status: getRes.status, contentType: getRes.headers.get('content-type'), contentLength: getRes.headers.get('content-length'), cacheControl: getRes.headers.get('cache-control') });
                        }
                    }
                    catch (checkErr) {
                        console.warn('[pdf][blob] verification request failed', { receiptId: receipt.id, url: pdfUrlFull, error: checkErr instanceof Error ? checkErr.message : String(checkErr) });
                    }
                }
                catch (blobErr) {
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
                    pdfUrlCustomer = await (0, storage_1.uploadBufferToS3)(bucket, keyCust, pdfCustomerBuffer, 'application/pdf', retentionDays);
                    pdfKeyCustomer = keyCust;
                }
                if (pdfFullBuffer) {
                    pdfUrlFull = await (0, storage_1.uploadBufferToS3)(bucket, keyFull, pdfFullBuffer, 'application/pdf', retentionDays);
                    pdfKeyFull = keyFull;
                }
                uploadedAny = Boolean(pdfUrlCustomer || pdfUrlFull);
            }
        }
        // Verify uploaded blob URLs are actually reachable (avoid sending bad
        // storage links to third-party services). If verification fails, clear
        // the URL so callers will fall back to the server proxy endpoint.
        try {
            if (pdfUrlCustomer) {
                const ok = await isPdfUrlAccessible(pdfUrlCustomer);
                if (!ok) {
                    console.warn('[pdf][blob] uploaded customer PDF not accessible after upload; clearing URL', { receiptId: receipt.id, url: pdfUrlCustomer });
                    pdfUrlCustomer = null;
                    pdfKeyCustomer = null;
                }
            }
            if (pdfUrlFull) {
                const okFull = await isPdfUrlAccessible(pdfUrlFull);
                if (!okFull) {
                    console.warn('[pdf][blob] uploaded full PDF not accessible after upload; clearing URL', { receiptId: receipt.id, url: pdfUrlFull });
                    pdfUrlFull = null;
                    pdfKeyFull = null;
                }
            }
        }
        catch (e) {
            console.warn('[pdf][blob] error verifying uploaded blob URLs', e);
        }
        channelStatus.pdfUpload = uploadedAny ? 'uploaded' : 'skipped';
        logStep(requestId, 'BLOB', uploadedAny ? 'ok' : 'skipped', {
            url_customer: pdfUrlCustomer,
            url_full: pdfUrlFull,
            uploadedAny,
        });
    }
    catch (e) {
        console.error('Failed to upload PDF to storage', e);
        errors.push({ channel: 'pdfUpload', error: String(e) });
        channelStatus.pdfUpload = 'failed';
        logStep(requestId, 'BLOB', 'failed', { error: String(e) });
    }
    await persistReceiptFiles({
        receiptId: receipt.id,
        pdfUrlCustomer,
        pdfKeyCustomer,
        pdfCustomerBuffer,
        pdfUrlFull,
        pdfKeyFull,
        pdfFullBuffer,
        actorId: actorId ?? undefined,
        retentionDays,
    });
    const candidatePdfUrl = pdfUrlCustomer ?? pdfUrlFull;
    const rawCustomerPhone = (receipt.order?.customerPhone ?? receipt.data?.customerPhone ?? "")
        .toString()
        .trim();
    const normalizedChatracePhone = (0, phone_1.normalizePhone)(rawCustomerPhone);
    const totals = typeof receipt.totals === "object" && receipt.totals ? receipt.totals : null;
    const totalField = totals?.total;
    const numericTotal = typeof totalField === "number"
        ? totalField
        : typeof totalField === "string"
            ? Number(totalField)
            : NaN;
    const invoiceAmount = Number.isFinite(numericTotal)
        ? numericTotal
        : typeof receipt.order?.totalAmount === "number"
            ? receipt.order.totalAmount
            : 0;
    const getChatraceMetaUpdate = async (updates) => {
        const baseData = typeof receipt.data === "object" && receipt.data
            ? { ...receipt.data }
            : {};
        const existingChatrace = typeof baseData.chatrace === "object" && baseData.chatrace
            ? { ...baseData.chatrace }
            : {};
        const nextData = { ...baseData, chatrace: { ...existingChatrace, ...updates } };
        try {
            await prisma_1.prisma.receipt.update({ where: { id: receipt.id }, data: { data: nextData } });
        }
        catch (updateErr) {
            console.error('[receipts][chatrace] failed to persist metadata', updateErr);
        }
    };
    const site = getSiteUrl();
    const receiptPageLink = `${site.replace(/\/$/, '')}/receipts/${receipt.id}`;
    const finalChatracePdfUrl = await resolveChatracePdfUrl(site, receipt.id, candidatePdfUrl);
    const chatracePdfUrl = finalChatracePdfUrl.receiptUrl;
    if (normalizedChatracePhone) {
        console.info('[receiptSender] TRACE', { rid: requestId, receiptId: receipt.id, receiptNumber: receipt.order?.orderNumber ?? receipt.id });
        logStep(requestId, 'CHARTRACE', 'begin', {
            phone: normalizedChatracePhone,
            receiptUrlPresent: !!finalChatracePdfUrl.receiptUrl,
            mode: finalChatracePdfUrl.mode,
            candidatePdfUrl: !!candidatePdfUrl,
        });
        try {
            const receiptUrlStr = finalChatracePdfUrl.receiptUrl ?? '';
            const computedPdfUrlLength = receiptUrlStr.length;
            const finalMode = finalChatracePdfUrl.mode;
            const defaultTag = finalMode === 'pdf' || finalMode === 'proxy' ? 'receipt_created_pdf' : 'receipt_created_link';
            const finalTagName = (opts?.chatraceTag?.trim() || defaultTag);
            const skipDefaultChatraceTags = Boolean(opts?.skipDefaultChatraceTags);
            const tagForPush = opts?.chatraceTag?.trim() ? finalTagName : undefined;
            const finalReceiptUrl = finalMode === 'pdf' || finalMode === 'proxy' ? finalChatracePdfUrl.receiptUrl ?? undefined : undefined;
            console.info('[receipts][chatrace] preparing push', {
                receiptId: receipt.id,
                phoneNormalized: normalizedChatracePhone,
                receiptUrlPresent: !!finalChatracePdfUrl.receiptUrl,
                receiptUrlLength: computedPdfUrlLength,
                receiptMode: finalMode,
                CHATRACE_BASE_URL: !!process.env.CHATRACE_BASE_URL,
                CHATRACE_ACCOUNT_ID: !!process.env.CHATRACE_ACCOUNT_ID,
                tokenPresent: !!process.env.CHATRACE_API_TOKEN,
                tagName: finalTagName,
                skipDefaultChatraceTags,
                customTag: opts?.chatraceTag?.trim() ?? null,
            });
            const chitInput = {
                phoneE164: normalizedChatracePhone,
                customerName: receipt.order?.customerName ??
                    receipt.data?.customerName ??
                    'Customer',
                receiptNumber: receipt.order?.orderNumber ?? receipt.id,
                amount: Math.round(invoiceAmount).toString(),
                currency: 'KES',
                receiptLink: receiptPageLink,
                receiptUrl: finalReceiptUrl,
                receiptId: receipt.id,
                tagName: finalTagName,
            };
            console.info('[receipts][chatrace] outbound payload', { chitInput });
            const result = await (0, chatrace_1.pushReceiptToChatrace)({
                ...chitInput,
                tagName: tagForPush,
                skipDefaultTags: skipDefaultChatraceTags,
            });
            channelStatus.chatrace = result?.ok ? 'sent' : 'failed';
            if (!result?.ok) {
                errors.push({
                    channel: 'chatrace',
                    error: result?.debug?.error ?? 'Chatrace push failed',
                });
            }
            console.info('[receipts][chatrace] push result', {
                receiptId: receipt.id,
                ok: !!result?.ok,
                steps: result?.debug?.steps,
            });
            logStep(requestId, 'CHARTRACE', result?.ok ? 'ok' : 'failed', {
                contactCreated: result?.debug?.contactId,
                tagName: finalTagName,
                mode: finalMode,
                receiptLink: receiptPageLink.length,
                skipDefaultChatraceTags,
                customTag: opts?.chatraceTag?.trim() ?? null,
            });
            await getChatraceMetaUpdate({
                status: result?.ok ? 'sent' : 'failed',
                lastSentAt: result?.ok ? new Date().toISOString() : undefined,
                lastAttemptAt: result?.ok ? undefined : new Date().toISOString(),
                pdfUrl: finalChatracePdfUrl.receiptUrl ?? null,
                pdfMode: finalMode,
                receiptNumber: receipt.order?.orderNumber ?? receipt.id,
                debug: result?.debug,
            });
            // If this push is the creation-time POD send, record an explicit
            // audit flag so downstream duplicate-detection and business logic
            // can rely on a single canonical timestamp.
            try {
                const isPodTag = (opts?.chatraceTag || '').trim() === 'betech_dispatch_pay_on_delivery';
                const shouldMarkPodSent = Boolean(opts?.markPodSent) || isPodTag;
                if (result?.ok && shouldMarkPodSent) {
                    const baseData = typeof receipt.data === 'object' && receipt.data
                        ? { ...receipt.data }
                        : {};
                    const existingPod = typeof baseData.podDelivery === 'object' && baseData.podDelivery
                        ? { ...baseData.podDelivery }
                        : {};
                    const nextData = { ...baseData, podDelivery: { ...existingPod, sentAt: new Date().toISOString() } };
                    try {
                        await prisma_1.prisma.receipt.update({ where: { id: receipt.id }, data: { data: nextData } });
                        console.info('[receipts][podDelivery] marked creation-time podDelivery.sentAt', { receiptId: receipt.id });
                    }
                    catch (podErr) {
                        console.error('[receipts][podDelivery] failed to persist sentAt', podErr instanceof Error ? podErr.message : String(podErr));
                    }
                }
            }
            catch (e) {
                console.error('[receipts][podDelivery] unexpected error while marking podDelivery.sentAt', e);
            }
            if (receipt.id === 'Betech-20251218-21941') {
                console.error('[receipts][chatrace][DIAGNOSTIC] full debug', { receiptId: receipt.id, debug: result?.debug });
            }
        }
        catch (chErr) {
            const message = chErr instanceof Error ? chErr.message : String(chErr);
            if (receipt.id === 'Betech-20251218-21941') {
                console.error('[receipts][chatrace][DIAGNOSTIC] unexpected error', chErr);
            }
            else {
                console.error(`[receipts][chatrace] failed to push receipt ${receipt.id}`, message);
            }
            channelStatus.chatrace = 'failed';
            await getChatraceMetaUpdate({
                status: 'failed',
                lastAttemptAt: new Date().toISOString(),
                lastError: message,
            });
        }
    }
    else {
        channelStatus.chatrace = 'skipped';
        logStep(requestId, 'CHARTRACE', 'skipped');
    }
    // Email via SendGrid
    try {
        const toEmail = receipt.order?.customerEmail || receipt.data?.customerEmail;
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
            }
            else {
                try {
                    mail_1.default.setApiKey(rawSendgridKey);
                    const attachmentBuffer = pdfCustomerBuffer ?? Buffer.from('');
                    const msg = {
                        to: toEmail,
                        from: process.env.SENDGRID_FROM,
                        subject: `Your receipt ${receipt.order?.orderNumber ?? receipt.id}`,
                        text: `Please find your receipt attached.`,
                        attachments: attachmentBuffer.length
                            ? [{ content: attachmentBuffer.toString('base64'), filename: `receipt-${receipt.id}.pdf`, type: 'application/pdf', disposition: 'attachment' }]
                            : [],
                        html: `<p>Please find your receipt attached.</p>${pdfUrlCustomer ? `<p><a href="${pdfUrlCustomer}">Download receipt (link)</a></p>` : ''}`,
                    };
                    await mail_1.default.send(msg);
                    sent.push('email');
                    channelStatus.email = 'sent';
                    logStep(requestId, 'EMAIL', 'ok', { to: toEmail });
                }
                catch (emailErr) {
                    channelStatus.email = 'failed';
                    errors.push({ channel: 'email', error: emailErr instanceof Error ? emailErr.message : String(emailErr) });
                    logStep(requestId, 'EMAIL', 'failed', { error: emailErr instanceof Error ? emailErr.message : String(emailErr) });
                }
            }
        }
        else {
            channelStatus.email = wantEmail ? 'missing-recipient' : 'not-requested';
            const reason = wantEmail ? 'missing_recipient' : 'not_requested';
            logStep(requestId, 'EMAIL', reason);
        }
    }
    catch (e) {
        channelStatus.email = 'failed';
        errors.push({ channel: 'email', error: String(e) });
        logStep(requestId, 'EMAIL', 'failed', { error: String(e) });
    }
    // WhatsApp (customer) must be delivered via Chatrace only. Do not call
    // internal WhatsApp providers for customer notifications. SMS may still be
    // sent via Twilio if configured.
    try {
        const orderAny = receipt.order;
        const dataAny = receipt.data || {};
        const toPhone = (orderAny?.customerPhone || dataAny?.customerPhone || '').trim();
        if (!wantWhatsapp)
            channelStatus.whatsapp = 'skipped';
        if (!wantSms)
            channelStatus.sms = 'skipped';
        // Determine final receipt_url/mode for Chatrace (already computed earlier)
        const candidatePdf = candidatePdfUrl;
        const site = getSiteUrl();
        const receiptPage = `${site.replace(/\/$/, '')}/receipts/${receipt.id}`;
        const finalMode = finalChatracePdfUrl.mode;
        const defaultTag = finalMode === 'pdf' || finalMode === 'proxy' ? 'receipt_created_pdf' : 'receipt_created_link';
        const finalTag = (opts?.chatraceTag?.trim() || defaultTag);
        const skipDefaultChatraceTags = Boolean(opts?.skipDefaultChatraceTags);
        const tagForPush = opts?.chatraceTag?.trim() ? finalTag : undefined;
        const finalReceiptUrl = finalMode === 'pdf' || finalMode === 'proxy' ? finalChatracePdfUrl.receiptUrl ?? undefined : undefined;
        console.info('[receiptSender] final receipt_url resolution', {
            receiptId: receipt.id,
            candidatePdfUrl: candidatePdf,
            candidatePdfPresent: !!candidatePdf,
            finalReceiptUrl,
            mode: finalMode,
            finalTag,
            receiptPage,
        });
        // Set whatsapp channel status based solely on Chatrace push outcome
        if (wantWhatsapp) {
            if (channelStatus.chatrace === 'sent') {
                channelStatus.whatsapp = 'queued_via_chatrace';
                sent.push('whatsapp');
                logStep(requestId, 'WHATSAPP', 'queued_via_chatrace', { to: toPhone });
            }
            else if (channelStatus.chatrace === 'failed') {
                channelStatus.whatsapp = 'failed';
                errors.push({ channel: 'whatsapp', error: 'chatrace_push_failed' });
                logStep(requestId, 'WHATSAPP', 'failed', { reason: 'chatrace_push_failed' });
            }
        }
        // SMS: keep existing Twilio SMS behavior (if requested)
        if (wantSms) {
            const link = receiptPage;
            if (toPhone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_SMS) {
                const client = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                const smsPayload = { from: process.env.TWILIO_FROM_SMS, to: toPhone, body: `Your receipt: ${link}` };
                if (pdfUrlCustomer)
                    smsPayload.mediaUrl = [pdfUrlCustomer];
                await client.messages.create(smsPayload);
                sent.push('sms');
                channelStatus.sms = 'sent';
                logStep(requestId, 'SMS', 'ok', { to: toPhone });
            }
            else {
                channelStatus.sms = 'failed';
                errors.push({ channel: 'sms', error: 'SMS provider not configured or missing phone' });
                logStep(requestId, 'SMS', 'failed', { reason: 'missing_provider_or_phone' });
            }
        }
    }
    catch (e) {
        if (channelStatus.whatsapp === 'pending')
            channelStatus.whatsapp = 'failed';
        if (channelStatus.sms === 'pending')
            channelStatus.sms = 'failed';
        errors.push({ channel: 'send', error: String(e) });
        logStep(requestId, 'SEND', 'failed', { error: String(e) });
    }
    // write audit log of send attempt
    try {
        if (actorId) {
            await prisma_1.prisma.actionLog.create({ data: { actorId, entity: 'Receipt', entityId: receiptId, action: 'SEND', before: receipt, after: { sent, errors } } });
        }
        else {
            // If no actorId resolved (should be rare), avoid writing a bad FK value.
            console.warn('[receiptSender] skipping actionLog.create: no actorId available', { receiptId });
        }
    }
    catch (e) {
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
async function persistReceiptFiles(params) {
    const { receiptId, pdfUrlCustomer, pdfKeyCustomer, pdfCustomerBuffer, pdfUrlFull, pdfKeyFull, pdfFullBuffer, actorId, retentionDays, } = params;
    const hasNonEmptyUrl = (value) => typeof value === 'string' && value.trim().length > 0;
    try {
        if (hasNonEmptyUrl(pdfUrlCustomer)) {
            await prisma_1.prisma.receiptFile.create({
                data: {
                    receiptId,
                    key: pdfKeyCustomer ?? undefined,
                    url: pdfUrlCustomer,
                    contentType: 'application/pdf',
                    size: pdfCustomerBuffer?.length ?? undefined,
                    uploadedBy: actorId ?? undefined,
                    expiresAt: retentionDays ? new Date(Date.now() + retentionDays * 86400000) : undefined,
                },
            });
        }
        else {
            console.warn('[receiptSender] skipping ReceiptFile.create for customer PDF: missing url', {
                receiptId,
                pdfUrlCustomerPresent: hasNonEmptyUrl(pdfUrlCustomer),
                pdfKeyCustomerPresent: !!pdfKeyCustomer,
                bufferLen: pdfCustomerBuffer?.length ?? 0,
            });
        }
        if (hasNonEmptyUrl(pdfUrlFull)) {
            await prisma_1.prisma.receiptFile.create({
                data: {
                    receiptId,
                    key: pdfKeyFull ?? undefined,
                    url: pdfUrlFull,
                    contentType: 'application/pdf',
                    size: pdfFullBuffer?.length ?? undefined,
                    uploadedBy: actorId ?? undefined,
                    expiresAt: retentionDays ? new Date(Date.now() + retentionDays * 86400000) : undefined,
                },
            });
        }
        else {
            console.warn('[receiptSender] skipping ReceiptFile.create for full PDF: missing url', {
                receiptId,
                pdfUrlFullPresent: hasNonEmptyUrl(pdfUrlFull),
                pdfKeyFullPresent: !!pdfKeyFull,
                bufferLen: pdfFullBuffer?.length ?? 0,
            });
        }
    }
    catch (error) {
        console.error('[receiptSender] failed to create ReceiptFile record', error);
    }
}
