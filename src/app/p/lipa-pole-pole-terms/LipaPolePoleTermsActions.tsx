"use client";

import { Printer } from "lucide-react";

export default function LipaPolePoleTermsActions() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2.5 text-sm font-bold text-amber-50 transition hover:-translate-y-0.5 hover:bg-amber-300/20 print:hidden"
    >
      <Printer className="h-4 w-4" />
      Print / Save PDF
    </button>
  );
}
