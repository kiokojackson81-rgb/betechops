#!/usr/bin/env node
// Simple test script to send a WhatsApp text message via Meta Graph API.
// Usage (PowerShell):
//   $env:WHATSAPP_META_TOKEN = '<PASTE_TOKEN_HERE>'
//   $env:WHATSAPP_PHONE_NUMBER_ID = '839565812584120'
//   $env:WHATSAPP_ADMIN_PHONE = '+254738591398'
//   node scripts/test-whatsapp.js

(async function main() {
  const token = process.env.WHATSAPP_META_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = process.env.WHATSAPP_ADMIN_PHONE;

  if (!token || !phoneId || !to) {
    console.error('Missing required env vars. Set WHATSAPP_META_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_ADMIN_PHONE.');
    process.exit(2);
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: to.replace(/^\+/, ''),
    type: 'text',
    text: { body: `betechops test message at ${new Date().toISOString()}` },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error('WhatsApp API returned an error:', res.status, data);
      process.exit(3);
    }

    console.log('WhatsApp API response:');
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error sending WhatsApp message:', err);
    process.exit(4);
  }
})();
