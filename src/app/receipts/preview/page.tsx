"use client";
import React, { useEffect, useState } from "react";
import ReceiptPrintView from "../_components/ReceiptPrintView";

type PaperSize = "a4" | "a5" | "roll80";
const allowedSizes: PaperSize[] = ["a4", "a5", "roll80"];

export default function ReceiptPreviewPage() {
  const [data, setData] = useState<any>(null);
  const [paperSize, setPaperSize] = useState<PaperSize>("a5");
  const [err, setErr] = useState<string | null>(null);
  const [shouldPrint, setShouldPrint] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const enc = params.get("draft");
      if (!enc) return setErr("No draft provided");
      const json = decodeURIComponent(enc);
      const parsed = JSON.parse(atob(json));
      setData(parsed);
    const sizeParam = params.get("size");
    const autoPrintParam = params.get("autoPrint");
    if (autoPrintParam) {
      setShouldPrint(autoPrintParam === "1");
    }
      if (sizeParam && allowedSizes.includes(sizeParam as PaperSize)) {
        setPaperSize(sizeParam as PaperSize);
      } else if (parsed?.paperSize && allowedSizes.includes(parsed.paperSize as PaperSize)) {
        setPaperSize(parsed.paperSize as PaperSize);
      }
    } catch (e) {
      setErr("Invalid draft data");
    }
  }, []);

  useEffect(() => {
    if (shouldPrint && data) {
      const timer = setTimeout(() => window.print(), 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [shouldPrint, data]);

  if (err) return <div className="p-6">{err}</div>;
  if (!data) return <div className="p-6">Loading preview.</div>;

  return (
    <div className="p-6 bg-slate-100 min-h-screen flex justify-center">
      <div className="bg-white shadow max-w-4xl w-full p-8">
        <div className="no-print flex justify-end mb-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200"
          >
            Print Receipt
          </button>
        </div>
        <ReceiptPrintView data={data} mode="preview" paperSize={paperSize} />
      </div>
    </div>
  );
}
