# Meta / WhatsApp Templates (drafts for approval)

This document lists the Meta/WhatsApp message templates used by the system. These are intended to be reviewed/approved in the Meta Business Manager if you want to send them as templated messages via the WhatsApp API.

When requesting approval, provide the exact text and list of placeholders used. Placeholders are written as `{{placeholderName}}` and will be replaced server-side before sending.

## Templates

- **customer_receipt** (Customer receipt — soft-copy)
  - Language: `en_US`
  - Text:

```
Hello {{customerName}},

Thank you for your purchase. Your receipt ({{receiptNumber}}) for KES {{total}} is attached.

Items: {{itemsCount}} • Payment: {{paymentMethod}}

If you have any questions reply to this message.

{{companyName}}
```

  - Notes: Soft-copy PDF must not show the printed stamp/signature. The attachment will be a PDF generated without the stamp.

- **admin_daily_summary** (Admin daily summary — per attendant)
  - Language: `en_US`
  - Text:

```
Daily report from {{attendantName}} ({{date}}):
Total Sales: KES {{totalSales}}
Total Profit: KES {{totalProfit}}
Receipts: {{totalReceipts}}
Items: {{totalItems}}
```

  - Notes: Sent to the admin phone configured in `ADMIN_PHONE` when a support attendant submits a daily report.

- **support_acknowledgement** (Attendant acknowledgement)
  - Language: `en_US`
  - Text:

```
Thanks {{attendantName}} — your support report for {{date}} has been saved.
Total Sales: KES {{totalSales}} • Receipts: {{totalReceipts}}
```

- **receipt_reminder** (Optional follow-up)
  - Language: `en_US`
  - Text:

```
Hi {{customerName}}, we couldn't capture all details for receipt {{receiptNumber}}. Please contact support or reply to this message so we can complete your receipt.
```

## Example Graph API payload (send using Meta Business API)

Replace `PHONE_ID`, `ACCESS_TOKEN`, and `TO_PHONE` with real values.

```
POST https://graph.facebook.com/v16.0/PHONE_ID/messages
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "TO_PHONE",
  "type": "template",
  "template": {
    "name": "customer_receipt",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "John Doe" },
          { "type": "text", "text": "RCPT-12345" },
          { "type": "text", "text": "1,250" }
        ]
      }
    ]
  }
}
```

Notes:
- Meta requires that template variable positions and counts match the approved template body. The project currently renders templates server-side and can also send free-form messages (text + media) if you prefer not to submit templates for approval.
- For attachments (PDFs) the recommended approach is to upload the PDF to your storage (S3) and send the file link inside a text message, or use the media API if you have Meta-hosted media. For many flows we attach the customer soft-copy PDF link in the message body.

## How to preview a template locally

The project includes a small helper at `src/lib/metaTemplates.ts`. Use `renderTemplateById(id, data)` to produce a filled draft for approval. Example:

```ts
import { renderTemplateById } from '@/lib/metaTemplates';

console.log(
  renderTemplateById('customer_receipt', {
    customerName: 'Jane',
    receiptNumber: 'RCPT-2025-001',
    total: 1250,
    itemsCount: 3,
    paymentMethod: 'MPESA',
    companyName: 'BeTech Ops',
  }),
);
```

This will print the message as it would appear when sent (placeholders replaced).

---

If you'd like, I can:
- generate ready-to-submit template payloads for Meta Business Manager approval,
- produce screenshots / PDF previews of the messages, or
- adapt the texts to another tone/shorter variants for fast approval.
