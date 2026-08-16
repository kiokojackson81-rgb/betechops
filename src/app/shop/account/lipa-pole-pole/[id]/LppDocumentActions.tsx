"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function LppDocumentActions({
  autoPrint = false,
  backHref,
}: {
  autoPrint?: boolean;
  backHref: string;
}) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  if (autoPrint) return null;

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className="rounded-full bg-[#7a0000] px-4 py-2 text-sm font-bold text-white">
        Print / Save PDF
      </button>
      <Link href={backHref} className="rounded-full border border-[#7a0000]/20 px-4 py-2 text-sm font-bold text-[#7a0000]">
        Back to account
      </Link>
    </div>
  );
}
