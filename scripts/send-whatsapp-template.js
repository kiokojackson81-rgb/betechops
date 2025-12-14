#!/usr/bin/env node
// Simple helper to send a WhatsApp template message using the Meta Graph API.
// Usage (PowerShell):
//   $env:WHATSAPP_PHONE_NUMBER_ID = "<phone id>"
//   $env:WHATSAPP_ACCESS_TOKEN = "<access token>"
//   node scripts/send-whatsapp-template.js [toPhone] [templateName] [lang] [param]
// Example:
//   node scripts/send-whatsapp-template.js 254705663175 hello_world en_US taste

const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

const args = process.argv.slice(2);
const TO = args[0] || process.env.TO_PHONE || '254705663175';
const TEMPLATE = args[1] || process.env.WHATSAPP_TEMPLATE || 'hello_world';
const LANG = args[2] || process.env.WHATSAPP_TEMPLATE_LANG || 'en_US';
const PARAM = args[3] || process.env.WHATSAPP_TEMPLATE_PARAM || 'taste';

if (!PHONE_ID || !TOKEN) {
  console.error('Missing environment variables: set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN');
  process.exit(1);
}

async function main() {
  const url = `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: TO,
    type: 'template',
    template: {
      name: TEMPLATE,
      language: { code: LANG },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: PARAM }
          ]
        }
      ]
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Send failed:', res.status, data);
      process.exit(2);
    }

    console.log('Send success:', data);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(3);
  }
}

main();
