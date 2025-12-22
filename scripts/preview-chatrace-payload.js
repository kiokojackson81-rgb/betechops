// scripts/preview-chatrace-payload.js
// Build and print the Chatrace /contacts payload using the same action format

function setFieldValue(fieldName, value) {
  return {
    action: 'set_field_value',
    field_name: fieldName,
    value: value == null ? '' : String(value),
  };
}

function buildPayload({ phoneE164, customerName, receiptNumber, amount, currency, receiptLink, receiptUrl, receiptId, tagName }) {
  const receiptUrlTrimmed = receiptUrl ? String(receiptUrl).trim() : '';
  const actions = [];
  if (receiptUrlTrimmed) {
    actions.push(setFieldValue('receipt_url', receiptUrlTrimmed));
  } else if (receiptLink) {
    actions.push(setFieldValue('receipt_url', receiptLink));
  }

  actions.push(setFieldValue('customer_name', customerName || 'Customer'));
  actions.push(setFieldValue('order_placed', receiptNumber));
  actions.push(setFieldValue('amount', amount));
  actions.push(setFieldValue('currency', currency || 'KES'));
  if (receiptId) actions.push(setFieldValue('receipt_id', receiptId));

  const pdfRegex = /\.pdf(\?|$)/i;
  const finalTag = (tagName && String(tagName).trim()) || (receiptUrlTrimmed && pdfRegex.test(receiptUrlTrimmed) ? 'receipt_created_pdf' : 'receipt_created_link');
  actions.push({ action: 'add_tag', tag_name: finalTag });

  const body = { phone: phoneE164, first_name: customerName || 'Customer', actions };
  return { body, debug: { phoneE164, receiptUrl: receiptUrlTrimmed || receiptLink, tag: finalTag } };
}

function prettyPrint(title, obj) {
  console.log('---', title, '---');
  console.log(JSON.stringify(obj, null, 2));
  console.log();
}

const sample = {
  phoneE164: '+254700000000',
  customerName: 'Test Customer',
  receiptNumber: 'TEST-123',
  amount: '1000',
  currency: 'KES',
  receiptLink: 'https://ops.betech.co.ke/receipts/TEST-123',
  receiptId: 'TEST-123',
};

// Variant A: PDF (proxy)
const pdfVariant = buildPayload({ ...sample, receiptUrl: 'https://ops.betech.co.ke/api/receipts/TEST-123/pdf' });
prettyPrint('Chatrace payload (PDF/proxy)', pdfVariant);

// Variant B: Page link (no PDF)
const linkVariant = buildPayload({ ...sample, receiptUrl: '' });
prettyPrint('Chatrace payload (Page link)', linkVariant);

// Variant C: direct blob URL ending with .pdf
const blobVariant = buildPayload({ ...sample, receiptUrl: 'https://blob.storage.example/receipts/TEST-123.pdf' });
prettyPrint('Chatrace payload (Blob .pdf)', blobVariant);

console.log('Done.');
