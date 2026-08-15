import { getSerializedLppAccountDetail } from "@/lib/lipaPolePoleService";
import { getBranding } from "@/lib/branding";
import BookingReceiptAutoPrint from "./BookingReceiptAutoPrint";
import BookingReceiptPrintControls from "./BookingReceiptPrintControls";

export const dynamic = "force-dynamic";

type Params = { id: string } | Promise<{ id: string }>;
type SearchParams =
  | { [key: string]: string | string[] | undefined }
  | Promise<{ [key: string]: string | string[] | undefined }>;

function formatKes(value: number) {
  return `KES ${Math.round(Number(value || 0)).toLocaleString("en-KE")}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function titleCase(value: string | null | undefined) {
  if (!value) return "Not captured";
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferInstallmentFrequency(
  installments: Array<{ dueDate: string }>,
  createdAt: string,
): "WEEKLY" | "MONTHLY" | null {
  if (!installments.length) return null;
  const created = new Date(createdAt);
  const firstDue = new Date(installments[0].dueDate);
  if (Number.isNaN(created.getTime()) || Number.isNaN(firstDue.getTime())) return null;
  const days = Math.round((firstDue.getTime() - created.getTime()) / 86400000);
  return days <= 10 ? "WEEKLY" : "MONTHLY";
}

export default async function LppBookingReceiptPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: SearchParams;
}) {
  const resolvedParams = typeof (params as Promise<{ id: string }>)?.then === "function" ? await (params as Promise<{ id: string }>) : (params as { id: string });
  const resolvedSearchParams =
    searchParams && typeof (searchParams as Promise<{ [key: string]: string | string[] | undefined }>)?.then === "function"
      ? await (searchParams as Promise<{ [key: string]: string | string[] | undefined }>)
      : (searchParams as { [key: string]: string | string[] | undefined } | undefined);

  const autoPrintRaw = resolvedSearchParams?.autoPrint;
  const autoPrint = (Array.isArray(autoPrintRaw) ? autoPrintRaw[0] : autoPrintRaw) === "1";

  const detail = await getSerializedLppAccountDetail(resolvedParams.id).catch(() => null);
  const branding = await getBranding();

  if (!detail) {
    return <div className="p-6 text-sm text-slate-600">Booking receipt not found.</div>;
  }

  const { account, payments, installments, summary } = detail;
  const firstSuccessfulPayment = payments.find((payment) => payment.status === "SUCCESS") ?? null;
  const paymentFrequency = inferInstallmentFrequency(installments, account.createdAt);
  const installmentAmount = installments[0]?.expectedAmount ?? 0;
  const location = [account.customerTown, account.customerEstateLandmark, account.customerCounty].filter(Boolean).join(", ");
  const letterheadUrl = branding.letterheadUrl || "/letterhead.jpg";
  const paymentMethod = firstSuccessfulPayment ? titleCase(firstSuccessfulPayment.method) : "Not captured";

  return (
    <div className="min-h-screen bg-slate-200 pb-10 text-slate-900">
      <style>{`
        @page { size: A5 portrait; margin: 2mm; }
        .lpp-booking-sheet {
          box-sizing: border-box;
          width: calc(148mm - 4mm);
          min-height: calc(210mm - 4mm);
          margin: 0 auto;
          padding: 2.5mm 3.5mm 3mm;
          background: #fff;
          border: 1px solid #d1d5db;
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
          font-family: "Segoe UI", Arial, Helvetica, sans-serif;
        }
        .lpp-letterhead {
          margin-bottom: 7px;
          padding-bottom: 6px;
          border-bottom: 1px solid #e5e7eb;
          text-align: center;
        }
        .lpp-letterhead img {
          display: block;
          width: 100%;
          max-height: 34mm;
          object-fit: contain;
          object-position: top center;
        }
        .lpp-document-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 7px 0;
        }
        .lpp-document-title h1 {
          margin: 0;
          color: ${branding.brandColor};
          font-size: 15px;
          font-weight: 800;
          letter-spacing: .09em;
          text-transform: uppercase;
        }
        .lpp-status-badge {
          border: 1px solid rgba(122, 32, 32, .2);
          border-radius: 999px;
          padding: 4px 9px;
          background: rgba(122, 32, 32, .06);
          color: ${branding.brandColor};
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .lpp-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin: 6px 0 10px;
          font-size: 11px;
        }
        .lpp-meta-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 8px 10px;
          background: #fafafa;
          line-height: 1.55;
        }
        .lpp-meta-card--right { text-align: right; }
        .lpp-items {
          width: 100%;
          margin-top: 8px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          border-spacing: 0;
          border-collapse: separate;
          overflow: hidden;
          font-size: 11px;
        }
        .lpp-items th {
          padding: 6px 8px;
          background: #f8fafc;
          color: ${branding.brandColor};
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .08em;
          text-align: left;
          text-transform: uppercase;
        }
        .lpp-items td {
          padding: 9px 8px;
          border-top: 1px solid #e5e7eb;
          vertical-align: top;
        }
        .lpp-product-row td {
          padding: 8px;
          background: #fffdf8;
        }
        .lpp-product-label {
          color: ${branding.brandColor};
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .lpp-product-name {
          margin-top: 3px;
          font-size: 11.5px;
          font-weight: 750;
          line-height: 1.4;
        }
        .lpp-right { text-align: right !important; }
        .lpp-totals {
          width: 62%;
          margin: 9px 0 0 auto;
          border-collapse: collapse;
          font-size: 11px;
        }
        .lpp-totals td { padding: 3px 0; }
        .lpp-totals td:last-child { text-align: right; font-weight: 700; }
        .lpp-total-row td {
          padding-top: 6px;
          border-top: 1px solid #d1d5db;
          color: ${branding.brandColor};
          font-size: 12px;
          font-weight: 800;
        }
        .lpp-balance-row td { color: #b45309; font-weight: 800; }
        .lpp-section {
          margin-top: 9px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: #fff;
          padding: 8px;
          break-inside: avoid;
        }
        .lpp-section-title {
          margin-bottom: 6px;
          color: ${branding.brandColor};
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .14em;
          text-transform: uppercase;
        }
        .lpp-plan-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px;
        }
        .lpp-plan-item {
          border-radius: 6px;
          background: #f8fafc;
          padding: 6px;
        }
        .lpp-plan-item span { display: block; color: #64748b; font-size: 8.5px; }
        .lpp-plan-item strong { display: block; margin-top: 2px; font-size: 10px; }
        .lpp-schedule {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 4px 10px;
          margin-top: 6px;
        }
        .lpp-schedule-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          padding: 4px 0;
          border-bottom: 1px dashed #e5e7eb;
          font-size: 9px;
        }
        .lpp-booking-notice {
          margin-top: 9px;
          border-left: 3px solid ${branding.brandColor};
          border-radius: 0 7px 7px 0;
          background: #fff7ed;
          padding: 7px 9px;
          color: #7c2d12;
          font-size: 9.5px;
          line-height: 1.45;
          break-inside: avoid;
        }
        .lpp-footer {
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px dashed rgba(0, 0, 0, .35);
          text-align: center;
          font-size: 10px;
          line-height: 1.45;
          break-inside: avoid;
        }
        .lpp-stamp-line {
          display: inline-block;
          width: 42mm;
          margin-left: 5px;
          border-bottom: 1px solid #64748b;
          vertical-align: middle;
        }
        @media print {
          .no-print { display: none !important; }
          html, body { margin: 0; padding: 0; background: #fff !important; }
          .lpp-booking-sheet {
            width: calc(148mm - 4mm);
            min-height: calc(210mm - 4mm);
            margin: 0;
            padding: 2mm 3mm 2.5mm;
            border: 0;
            box-shadow: none;
          }
          .lpp-letterhead, .lpp-meta, .lpp-items, .lpp-totals, .lpp-footer { break-inside: avoid; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @media (max-width: 620px) {
          .lpp-booking-sheet { width: 100%; min-height: 0; }
          .lpp-meta, .lpp-plan-grid, .lpp-schedule { grid-template-columns: 1fr; }
          .lpp-meta-card--right { text-align: left; }
          .lpp-totals { width: 100%; }
        }
      `}</style>
      <BookingReceiptAutoPrint enabled={autoPrint} />
      {!autoPrint ? <BookingReceiptPrintControls /> : null}

      <main className="lpp-booking-sheet">
        <header className="lpp-letterhead">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={letterheadUrl} alt={`${branding.siteTitle} letterhead`} />
        </header>

        <div className="lpp-document-title">
          <h1>Lipa Pole Pole Booking Receipt</h1>
          <span className="lpp-status-badge">Booking / Deposit</span>
        </div>

        <section className="lpp-meta">
          <div className="lpp-meta-card">
            <div><strong>M/S:</strong> {account.customerName || "Unknown customer"}</div>
            <div><strong>Phone:</strong> {account.customerPhone || "-"}</div>
            <div><strong>Email:</strong> {account.customerEmail || "-"}</div>
            <div><strong>Address:</strong> {location || "-"}</div>
          </div>
          <div className="lpp-meta-card lpp-meta-card--right">
            <div><strong>Booking No.</strong> {account.reference}</div>
            <div><strong>Date:</strong> {formatDate(account.createdAt)}</div>
            <div><strong>Payment:</strong> {paymentMethod}</div>
            {firstSuccessfulPayment?.reference ? <div><strong>Reference:</strong> {firstSuccessfulPayment.reference}</div> : null}
          </div>
        </section>

        <table className="lpp-items">
          <thead>
            <tr className="lpp-product-row">
              <td colSpan={3}>
                <div className="lpp-product-label">Item Name</div>
                <div className="lpp-product-name">{account.productName || "No product selected"}</div>
              </td>
            </tr>
            <tr>
              <th style={{ width: "20%" }}>Quantity</th>
              <th className="lpp-right">Unit Price</th>
              <th className="lpp-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{account.quantity}</td>
              <td className="lpp-right">{formatKes(account.agreedUnitPrice).replace("KES ", "")}</td>
              <td className="lpp-right"><strong>{formatKes(summary.agreedTotal).replace("KES ", "")}</strong></td>
            </tr>
          </tbody>
        </table>

        <table className="lpp-totals">
          <tbody>
            <tr className="lpp-total-row"><td>Agreed Total</td><td>{formatKes(summary.agreedTotal)}</td></tr>
            <tr><td>Initial Deposit</td><td>{formatKes(firstSuccessfulPayment?.amount ?? 0)}</td></tr>
            <tr><td>Total Paid</td><td>{formatKes(summary.totalPaid)}</td></tr>
            <tr className="lpp-balance-row"><td>Balance Due</td><td>{formatKes(summary.balance)}</td></tr>
          </tbody>
        </table>

        <section className="lpp-section">
          <div className="lpp-section-title">Lipa Pole Pole Payment Plan</div>
          <div className="lpp-plan-grid">
            <div className="lpp-plan-item"><span>Frequency</span><strong>{paymentFrequency ? titleCase(paymentFrequency) : "Not captured"}</strong></div>
            <div className="lpp-plan-item"><span>Installments</span><strong>{installments.length}</strong></div>
            <div className="lpp-plan-item"><span>Each payment</span><strong>{installmentAmount > 0 ? formatKes(installmentAmount) : "Not set"}</strong></div>
            <div className="lpp-plan-item"><span>Expected completion</span><strong>{formatDate(account.expectedCompletionDate)}</strong></div>
          </div>

          {installments.length > 0 ? (
            <div>
              <div className="lpp-section-title" style={{ marginTop: 8 }}>Payment Schedule</div>
              <div className="lpp-schedule">
                {installments.map((installment, index) => (
                  <div key={installment.id} className="lpp-schedule-row">
                    <span>{index + 1}. {formatDate(installment.dueDate)}</span>
                    <strong>{formatKes(installment.expectedAmount)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="lpp-booking-notice">
          <strong>Booking receipt only.</strong> This document confirms the Lipa Pole Pole booking and deposit received. It does not authorize product collection or release. Products are released only after the balance is paid in full.
        </aside>

        <footer className="lpp-footer">
          <div>Thank you for choosing {branding.siteTitle}. You were served by <strong>{account.salespersonName || "Not captured"}</strong>.</div>
          <div style={{ marginTop: 10 }}>Official Stamp:<span className="lpp-stamp-line" /></div>
        </footer>
      </main>
    </div>
  );
}
