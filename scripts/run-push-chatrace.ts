#!/usr/bin/env node
import 'ts-node/register';
import { pushReceiptToChatrace } from '../src/lib/integrations/chatrace.ts';

async function main() {
  const phone = process.env.TARGET_PHONE || '+254705663175';
  const receiptUrl = process.env.TEST_RECEIPT_URL || 'https://1jtqralhx6g8fulf.public.blob.vercel-storage.com/receipts/SEND-1766376110786/customer-QOeEgKlWWQkw0o29LubyGkJ63MrQcP.pdf';
  const receiptNumber = process.env.TEST_RECEIPT_NUMBER || 'SEND-1766376110786';

  console.info('[run-push-chatrace] calling pushReceiptToChatrace', { phone, receiptUrl, receiptNumber });

  const result = await pushReceiptToChatrace({
    phoneE164: phone,
    customerName: 'Test Customer',
    receiptNumber,
    amount: '123.45',
    currency: 'KES',
    receiptLink: `https://ops.betech.co.ke/receipts/${receiptNumber}`,
    receiptUrl,
    receiptId: receiptNumber,
  });

  console.log('pushReceiptToChatrace result:');
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
