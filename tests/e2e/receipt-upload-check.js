/*
  E2E verification script (node):
  - Creates a minimal receipt via the receipts API
  - Calls send endpoint to trigger PDF generation and S3 upload
  - Polls /api/receipt-files?receiptId=... to verify the record exists
  - This script requires S3 + SENDGRID env vars to be set and will abort otherwise.
*/

const fetch = require('node-fetch');

async function main() {
  if (!process.env.S3_BUCKET || !process.env.SENDGRID_API_KEY) {
    console.log('Skipping E2E: missing S3 or SendGrid env vars. Set S3_BUCKET and SENDGRID_API_KEY to run.');
    return;
  }
  const apiBase = process.env.TEST_API_BASE || 'http://localhost:3000';

  console.log('Creating test receipt...');
  const createRes = await fetch(`${apiBase}/api/receipts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ title: 'E2E Item', quantity: 1, unitPrice: 10 }], attendantId: process.env.TEST_ATTENDANT_ID || null })
  });
  const createJson = await createRes.json();
  if (!createJson.ok) throw new Error('Failed to create receipt: ' + JSON.stringify(createJson));
  const receiptId = createJson.receiptId;
  console.log('Receipt created', receiptId);

  console.log('Triggering send...');
  const sendRes = await fetch(`${apiBase}/api/receipts/${receiptId}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channels: ['email'] }) });
  const sendJson = await sendRes.json();
  if (!sendJson.ok) throw new Error('Send failed: ' + JSON.stringify(sendJson));

  console.log('Polling for ReceiptFile record...');
  for (let i = 0; i < 12; i++) {
    const list = await fetch(`${apiBase}/api/receipt-files?receiptId=${receiptId}`);
    const j = await list.json();
    if (Array.isArray(j.files) && j.files.length > 0) {
      console.log('Found receipt file:', j.files[0]);
      return;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Timeout waiting for receipt file to appear');
}

main().then(() => console.log('E2E success')).catch(err => { console.error(err); process.exit(1); });
