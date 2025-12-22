// scripts/send-real-chatrace.js
// Sends a real /contacts payload to Chatrace using env vars.
(async () => {
  try {
    const BASE_URL = (process.env.CHATRACE_BASE_URL || '').replace(/\/$/, '');
    const API_TOKEN = process.env.CHATRACE_API_TOKEN;
    const ACCOUNT_ID = process.env.CHATRACE_ACCOUNT_ID || '';
    if (!BASE_URL || !API_TOKEN) {
      console.error('Missing CHATRACE_BASE_URL or CHATRACE_API_TOKEN');
      process.exit(2);
    }

    const phone = process.env.TARGET_PHONE || '+254705663175';
    const customerName = process.env.TARGET_NAME || 'Customer';
    const receiptNumber = process.env.TARGET_RECEIPT || `SEND-${Date.now()}`;
    const amount = process.env.TARGET_AMOUNT || '1000';
    const currency = process.env.TARGET_CURRENCY || 'KES';
    const receiptLink = process.env.TARGET_LINK || `https://ops.betech.co.ke/receipts/${receiptNumber}`;
    const receiptUrl = process.env.TARGET_PDF_URL || '';
    const receiptId = process.env.TARGET_RECEIPT_ID || receiptNumber;
    const tagName = process.env.TARGET_TAG || '';

    const setFieldValue = (fieldName, value) => ({ action: 'set_field_value', field_name: fieldName, value: value == null ? '' : String(value) });
    const actions = [];
    if (receiptUrl && String(receiptUrl).trim()) {
      actions.push(setFieldValue('receipt_url', String(receiptUrl).trim()));
    } else if (receiptLink) {
      actions.push(setFieldValue('receipt_url', receiptLink));
    }
    actions.push(setFieldValue('customer_name', customerName || 'Customer'));
    actions.push(setFieldValue('order_placed', receiptNumber));
    actions.push(setFieldValue('amount', amount));
    actions.push(setFieldValue('currency', currency || 'KES'));
    if (receiptId) actions.push(setFieldValue('receipt_id', receiptId));

    const pdfRegex = /\.pdf(\?|$)/i;
    const finalTag = (tagName && String(tagName).trim()) || (receiptUrl && pdfRegex.test(String(receiptUrl)) ? 'receipt_created_pdf' : 'receipt_created_link');
    actions.push({ action: 'add_tag', tag_name: finalTag });

    const body = { phone, first_name: customerName || 'Customer', actions };

    const url = `${BASE_URL}/contacts`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-ACCESS-TOKEN': API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await res.text().catch(() => '');
    console.log('CHATRACE POST', { url: `${BASE_URL}/contacts`, status: res.status });
    // Print trimmed response body
    const snippet = (text || '').slice(0, 2000);
    console.log('response_snippet:', snippet);
    process.exit(res.ok ? 0 : 1);
  } catch (e) {
    console.error('send-real-chatrace failed', e);
    process.exit(3);
  }
})();
