# Ready-to-submit Meta (WhatsApp) Template Payloads

This document contains exact template bodies and placeholder mappings prepared for submission/approval in Meta Business Manager. Each template includes:

- Template `name` (internal id used when sending)
- Language code (e.g. `en_US`)
- Exact body text (use this string when requesting template approval)
- Placeholder mapping (names and example values)
- Example Graph API payload for sending the template via the WhatsApp `messages` endpoint (Graph API v16+)

Notes:
- When submitting for approval in Meta Business Manager, provide the exact body strings below. Do not include example values — use the placeholder format `{{placeholder}}` exactly as shown.
- After approval, `name` must be used as the template identifier in the `messages` endpoint.
- The `messages` endpoint expects `components` to match the template structure. We provide example `components` with `body` parameters ordered to correspond to placeholders in the body text.

---

## 1) customer_receipt
- Template name: `customer_receipt`
- Language: `en_US`
- Category: `TRANSACTIONAL` (recommended)

Exact body to submit for approval:

```
Hello {{customerName}},

Thank you for your purchase. Your receipt ({{receiptNumber}}) for KES {{total}} is attached.

Items: {{itemsCount}} • Payment: {{paymentMethod}}

If you have any questions reply to this message.

{{companyName}}
```

Placeholders and example values (for send-time mapping):
- `customerName` — "Jane"
- `receiptNumber` — "RCPT-2025-001"
- `total` — "1,250"
- `itemsCount` — "3"
- `paymentMethod` — "MPESA"
- `companyName` — "BeTech Ops"

Example Graph API `messages` payload to SEND (replace `PHONE_ID`, `ACCESS_TOKEN`, `TO_PHONE`):

```json
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
          { "type": "text", "text": "Jane" },
          { "type": "text", "text": "RCPT-2025-001" },
          { "type": "text", "text": "1,250" },
          { "type": "text", "text": "3" },
          { "type": "text", "text": "MPESA" },
          { "type": "text", "text": "BeTech Ops" }
        ]
      }
    ]
  }
}
```

Notes on attachments: Meta Business template messages cannot directly attach arbitrary external files via template components. For soft-copy receipts we recommend uploading the generated customer PDF to your S3 and including the link inside a follow-up text or by sending a separate `media` message (Media must be uploaded via Meta's media endpoint or accessible via a publicly reachable URL). For approval, use the template body above — the system will handle attaching the PDF when sending.

---

## 2) admin_daily_summary
- Template name: `admin_daily_summary`
- Language: `en_US`
- Category: `UTILITY` (or `TRANSACTIONAL`)

Exact body to submit for approval:

```
Daily report from {{attendantName}} ({{date}}):
Total Sales: KES {{totalSales}}
Total Profit: KES {{totalProfit}}
Receipts: {{totalReceipts}}
Items: {{totalItems}}
```

Placeholders and example values:
- `attendantName` — "John Doe"
- `date` — "2025-12-11"
- `totalSales` — "10,500"
- `totalProfit` — "2,150"
- `totalReceipts` — "12"
- `totalItems` — "18"

Example send payload:

```json
POST https://graph.facebook.com/v16.0/PHONE_ID/messages
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "ADMIN_PHONE",
  "type": "template",
  "template": {
    "name": "admin_daily_summary",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "John Doe" },
          { "type": "text", "text": "2025-12-11" },
          { "type": "text", "text": "10,500" },
          { "type": "text", "text": "2,150" },
          { "type": "text", "text": "12" },
          { "type": "text", "text": "18" }
        ]
      }
    ]
  }
}
```

---

## 3) support_acknowledgement
- Template name: `support_acknowledgement`
- Language: `en_US`
- Category: `CONFIRMATION`

Exact body to submit:

```
Thanks {{attendantName}} — your support report for {{date}} has been saved.
Total Sales: KES {{totalSales}} • Receipts: {{totalReceipts}}
```

Placeholders and example values:
- `attendantName` — "John Doe"
- `date` — "2025-12-11"
- `totalSales` — "10,500"
- `totalReceipts` — "12"

Example send payload:

```json
POST https://graph.facebook.com/v16.0/PHONE_ID/messages
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "ATTENDANT_PHONE",
  "type": "template",
  "template": {
    "name": "support_acknowledgement",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "John Doe" },
          { "type": "text", "text": "2025-12-11" },
          { "type": "text", "text": "10,500" },
          { "type": "text", "text": "12" }
        ]
      }
    ]
  }
}
```

---

## 4) receipt_reminder
- Template name: `receipt_reminder`
- Language: `en_US`
- Category: `NOTIFICATION`

Exact body to submit:

```
Hi {{customerName}}, we couldn't capture all details for receipt {{receiptNumber}}. Please contact support or reply to this message so we can complete your receipt.
```

Placeholders & example values:
- `customerName` — "Jane"
- `receiptNumber` — "RCPT-2025-001"

Example send payload:

```json
POST https://graph.facebook.com/v16.0/PHONE_ID/messages
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "TO_PHONE",
  "type": "template",
  "template": {
    "name": "receipt_reminder",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Jane" },
          { "type": "text", "text": "RCPT-2025-001" }
        ]
      }
    ]
  }
}
```

---

## Tips when submitting templates for approval

- Keep the body concise and avoid uncommon words or emojis that might delay approval.
- Use the placeholder names above; if you change placeholder names, update the send code accordingly.
- Choose the proper category (`TRANSACTIONAL`, `UTILITY`, `CONFIRMATION`, etc.) to expedite approval.
- If you need localized versions (e.g., `sw_KE`), create separate template variants with identical placeholder positions.

If you'd like, I can also:
- create the `components` arrays programmatically in a helper (TypeScript) file in the repo, or
- create localized (Swahili) variants of the templates and example payloads.
