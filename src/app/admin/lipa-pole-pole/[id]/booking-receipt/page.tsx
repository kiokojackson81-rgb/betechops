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
  const location = [account.customerTown, account.customerEstateLandmark, account.customerCounty].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-slate-200 pb-10">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
      <BookingReceiptAutoPrint enabled={autoPrint} />
      {!autoPrint ? <BookingReceiptPrintControls /> : null}

      <div className="mx-auto w-full max-w-[148mm] bg-white p-6 text-slate-900 shadow-xl print:max-w-none print:shadow-none">
        <div className="border-b border-slate-200 pb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: branding.brandColor }}>
            {branding.siteTitle}
          </div>
          <h1 className="mt-2 text-2xl font-bold uppercase tracking-tight">Lipa Pole Pole Booking Receipt</h1>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <div className="text-slate-500">Booking No</div>
              <div className="font-semibold">{account.reference}</div>
            </div>
            <div>
              <div className="text-slate-500">Date</div>
              <div className="font-semibold">{formatDate(account.createdAt)}</div>
            </div>
          </div>
        </div>

        <section className="border-b border-slate-200 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Customer</div>
          <div className="mt-3 space-y-1 text-sm">
            <div className="font-semibold">{account.customerName || "Unknown customer"}</div>
            <div>{account.customerPhone || "No phone"}</div>
            {account.customerEmail ? <div>{account.customerEmail}</div> : null}
            {location ? <div>{location}</div> : null}
          </div>
        </section>

        <section className="border-b border-slate-200 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Product</div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="font-semibold">{account.productName || "No product selected"}</div>
            <div>Quantity: {account.quantity}</div>
            <div>Unit Price: {formatKes(account.agreedUnitPrice)}</div>
          </div>
        </section>

        <section className="border-b border-slate-200 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Payment Summary</div>
          <div className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span>Agreed Total</span>
              <span className="font-semibold">{formatKes(summary.agreedTotal)}</span>
            </div>
            {firstSuccessfulPayment ? (
              <div className="flex items-center justify-between gap-4">
                <span>Initial Deposit</span>
                <span className="font-semibold">{formatKes(firstSuccessfulPayment.amount)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4">
              <span>Current Total Paid</span>
              <span className="font-semibold">{formatKes(summary.totalPaid)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Current Balance</span>
              <span className="font-semibold">{formatKes(summary.balance)}</span>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Payment Plan</div>
          <div className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span>Frequency</span>
              <span className="font-semibold">{paymentFrequency ? titleCase(paymentFrequency) : "Not captured"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Remaining Installments</span>
              <span className="font-semibold">{installments.length}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Expected Completion</span>
              <span className="font-semibold">{formatDate(account.expectedCompletionDate)}</span>
            </div>
          </div>

          {installments.length > 0 ? (
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Payment Schedule</div>
              <div className="space-y-2">
                {installments.map((installment, index) => (
                  <div key={installment.id} className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span>{index + 1}. {formatDate(installment.dueDate)}</span>
                    <span className="font-semibold">{formatKes(installment.expectedAmount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {firstSuccessfulPayment ? (
          <section className="border-b border-slate-200 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Deposit Payment</div>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span>Method</span>
                <span className="font-semibold">{titleCase(firstSuccessfulPayment.method)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Reference</span>
                <span className="font-semibold">{firstSuccessfulPayment.reference || "-"}</span>
              </div>
            </div>
          </section>
        ) : null}

        <section className="py-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Served By</span>
            <span className="font-semibold">{account.salespersonName || "Not captured"}</span>
          </div>
          <div className="mt-6 text-center text-sm text-slate-600">
            <div>Thank you for choosing {branding.siteTitle}.</div>
            <div className="mt-1">This receipt confirms your Lipa Pole Pole booking and payment received.</div>
          </div>
        </section>
      </div>
    </div>
  );
}
