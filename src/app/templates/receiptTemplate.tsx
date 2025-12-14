export default function renderReceiptTemplate(snapshot: any, opts: { hideStamp?: boolean } = {}) {
  const siteTitle = process.env.RECEIPT_SITE_TITLE || 'BETECH SOLAR SOLUTIONS';
  const logo = process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL || '/logo.png';
  const order = snapshot.order || {};
  const items = snapshot.items || order.items || [];
  const totals = snapshot.totals || order.totals || {};
  const notes = snapshot.notes || '';
  const attendant = (order?.attendant?.name) || snapshot.attendantName || snapshot.issuedByName || '';
  const paymentMethod = snapshot.paymentMethod || (order?.paymentMethod || '');
  const customerPhone = snapshot.customerPhone || order?.customerPhone || '';
  const deliveryAddress = snapshot.deliveryAddress || order?.deliveryAddress || '';

  const itemsHtml = items
    .map((it: any) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd">${(it.title || it.productName || '')}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">${it.quantity ?? 1}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${it.unitPrice ?? it.sellingPrice ?? ''}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${it.serial ?? ''}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${it.warranty ?? ''}</td>
      </tr>`)
    .join('');

  return `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Receipt ${order.orderNumber || ''}</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
      .page { max-width: 760px; margin: 0 auto; padding: 18px; border:1px solid #cbd5e1; border-radius:8px }
      header { text-align:center; margin-bottom:12px }
      header h1 { margin:0; font-size:28px; letter-spacing:1px }
      header p { margin:2px 0; color:#374151 }
      .meta { display:flex; justify-content:space-between; margin:12px 0 }
      table { width:100%; border-collapse: collapse; margin-top:8px }
      th { text-align:left; padding:8px; border-bottom:2px solid #e5e7eb }
      td { padding:8px }
      .right { text-align:right }
      .totals { width:100%; margin-top:12px }
      .totals td { border:none; padding:6px }
      .notes { margin-top:14px; padding:10px; background:#f8fafc; border-radius:6px }
      .signature { margin-top:20px; text-align:center }
    </style>
  </head>
  <body>
    <div class="page">
      <header>
        <h1>${siteTitle}</h1>
        <p>Dealers in: Solar Solutions, Solar Products, e.t.c</p>
        <p>Tel: 0722 151 083 / 0703 241 917 - Pramukh Plaza 3rd Floor Shop No. 3 Nairobi CBD</p>
        <p>Email: info@betech.co.ke - Website: www.betech.co.ke</p>
      </header>

      <div class="meta">
        <div>
          <div><strong>Date:</strong> ${new Date(snapshot.generatedAt || Date.now()).toLocaleString()}</div>
          <div><strong>M/S:</strong> ${snapshot.customerName || order?.customerName || ''}</div>
        </div>
        <div class="right">
          <div><strong>Receipt No.</strong> ${order.orderNumber || snapshot.serial || ''}</div>
          <div style="margin-top:6px"><strong>AAddress :</strong> ${deliveryAddress || '-'} </div>
        </div>
      </div>

      <table>
        <thead>
          <tr><th>Qty</th><th>Particulars</th><th class="right">@ (Ksh)</th><th class="right">Kshs.</th></tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <table class="totals">
        <tr><td></td><td class="right">Subtotal:</td><td class="right">${totals.subtotal ?? ''}</td></tr>
        <tr><td></td><td class="right"><strong>Total:</strong></td><td class="right"><strong>${totals.total ?? ''}</strong></td></tr>
      </table>

      <div style="margin-top:10px">
        <div><strong>Payment method:</strong> ${paymentMethod}</div>
        ${deliveryAddress ? `<div><strong>Deliver to:</strong> ${deliveryAddress}</div>` : ''}
      </div>

      ${notes ? `<div class="notes"><strong>Notes:</strong><div style="margin-top:6px">${notes}</div></div>` : ''}

      <div class="signature">
        <p>Thank you for shopping with Betech Solar Solutions. You were served by ${attendant || '____'}.</p>
        <p>Goods once sold cannot be refunded.</p>
        ${opts.hideStamp ? '' : '<div style="margin-top:18px">Official Stamp: __________________________</div>'}
      </div>

    </div>
  </body>
  </html>
  `;
}
