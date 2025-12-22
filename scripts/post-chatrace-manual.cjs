/* Post a Chatrace /contacts payload directly (CommonJS) */
(async function main() {
  const BASE = (process.env.CHATRACE_BASE_URL || 'https://api.chatrace.com').replace(/\/$/, '');
  const TOKEN = process.env.CHATRACE_API_TOKEN || '';
  const ACCOUNT = process.env.CHATRACE_ACCOUNT_ID || '';
  const phone = process.env.TARGET_PHONE || '+254705663175';
  const receiptUrl = process.env.TEST_RECEIPT_URL || 'https://1jtqralhx6g8fulf.public.blob.vercel-storage.com/receipts/SEND-1766376110786/customer-QOeEgKlWWQkw0o29LubyGkJ63MrQcP.pdf';
  const receiptNumber = process.env.TEST_RECEIPT_NUMBER || 'SEND-1766376110786';
  const receiptLink = `https://ops.betech.co.ke/receipts/${receiptNumber}`;

  function setField(fieldName, value) {
    return { action: 'set_field_value', field_name: fieldName, value: value == null ? '' : String(value) };
  }

  const actions = [];
  if (receiptUrl) {
    actions.push(setField('receipt_url', receiptUrl));
    actions.push(setField('media_url', receiptUrl));
    actions.push(setField('receipt_pdf_url', receiptUrl));
    actions.push(setField('file_url', receiptUrl));
  } else {
    actions.push(setField('receipt_url', receiptLink));
  }

  actions.push(setField('customer_name', 'Test Customer'));
  actions.push(setField('order_placed', receiptNumber));
  actions.push(setField('amount', '123.45'));
  actions.push(setField('currency', 'KES'));
  actions.push({ action: 'add_tag', tag_name: (/\.pdf(\?|$)/i.test(receiptUrl || '') ? 'receipt_created_pdf' : 'receipt_created_link') });

  const body = { phone: phone, first_name: 'Test Customer', actions };
  const headers = { 'X-ACCESS-TOKEN': TOKEN, Accept: 'application/json', 'Content-Type': 'application/json' };
  if (ACCOUNT) headers['X-ACCOUNT-ID'] = ACCOUNT;

  const url = BASE + '/contacts';
  console.log('[post-chatrace-manual] POST', url);
  console.log('[post-chatrace-manual] headers', Object.keys(headers));
  console.log('[post-chatrace-manual] payload preview', { phone, actionsCount: actions.length, tag: actions[actions.length-1] });

  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await res.text().catch(() => '');
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    console.log('[post-chatrace-manual] status', res.status);
    console.log('[post-chatrace-manual] bodySnippet', (text || '').slice(0, 200));
    console.log('[post-chatrace-manual] fullJson', JSON.stringify(json, null, 2));
    process.exit(res.ok ? 0 : 1);
  } catch (err) {
    console.error('[post-chatrace-manual] request failed', String(err));
    process.exit(2);
  }
})();
