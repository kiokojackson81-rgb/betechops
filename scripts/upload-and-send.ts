import 'dotenv/config';
import { uploadReceiptPdfToBlob } from '../src/lib/blob/uploadReceiptPdf.ts';

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const base = process.env.CHATRACE_BASE_URL || 'https://api.chatrace.com';
  const apiToken = process.env.CHATRACE_API_TOKEN;
  if (!token) throw new Error('Missing BLOB_READ_WRITE_TOKEN');
  if (!apiToken) throw new Error('Missing CHATRACE_API_TOKEN');

  const receiptId = process.env.TARGET_RECEIPT || `SEND-${Date.now()}`;
  const phone = process.env.TARGET_PHONE || '+254705663175';
  const receiptNumber = receiptId;

  // Minimal PDF-like content
  const pdfBuf = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 50 150 Td (Hello) Tj ET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000010 00000 n\ntrailer\n<< /Root 1 0 R >>\n%%EOF');

  console.info('Uploading PDF buffer to Vercel Blob...');
  const uploaded = await uploadReceiptPdfToBlob({ receiptId, kind: 'customer', buffer: pdfBuf });
  console.info('Uploaded:', uploaded);

  const receiptUrl = uploaded.url;
  const body = {
    phone: phone,
    first_name: process.env.TARGET_NAME || 'Customer',
    actions: [
      { action: 'set_field_value', field_name: 'receipt_url', value: receiptUrl },
      { action: 'set_field_value', field_name: 'customer_name', value: process.env.TARGET_NAME || 'Customer' },
      { action: 'set_field_value', field_name: 'order_placed', value: receiptNumber },
      { action: 'set_field_value', field_name: 'amount', value: process.env.TARGET_AMOUNT || '1000' },
      { action: 'set_field_value', field_name: 'currency', value: process.env.TARGET_CURRENCY || 'KES' },
      { action: 'add_tag', tag_name: 'receipt_created_pdf' },
    ],
  };

  console.info('Posting to Chatrace /contacts...');
  const res = await fetch(`${base}/contacts`, {
    method: 'POST',
    headers: { 'X-ACCESS-TOKEN': apiToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => '');
  console.info('Chatrace status', res.status, 'body:', text.slice(0, 2000));
}

main().catch((e) => {
  console.error('failed', e);
  process.exit(1);
});
