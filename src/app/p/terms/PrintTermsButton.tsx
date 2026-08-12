"use client";

export default function PrintTermsButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 print:hidden"
    >
      Print / Save PDF
    </button>
  );
}
