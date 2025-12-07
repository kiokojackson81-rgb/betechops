import React from 'react';
import ReceiptFormClient from './ReceiptFormClient';

export default function Page() {
  return (
    <div className="max-w-3xl mx-auto p-4">
      <ReceiptFormClient />
    </div>
  );
}
import React from 'react';
import ReceiptFormClient from './ReceiptFormClient';

export const dynamic = 'force-dynamic';

export default function NewReceiptPage() {
  return (
    <main>
      <ReceiptFormClient />
    </main>
  );
}
