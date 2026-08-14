"use client";

export default function BookingReceiptPrintControls() {
  return (
    <div className="no-print mx-auto mb-4 flex w-full max-w-[148mm] justify-end px-4 pt-4">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
      >
        Print
      </button>
    </div>
  );
}
