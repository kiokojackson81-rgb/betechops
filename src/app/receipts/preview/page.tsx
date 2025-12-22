"use client";
import React, { useEffect, useState } from "react";

export default function ReceiptPreviewPage() {
  const [html, setHtml] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const shouldAutoPrint = params.get("autoPrint") === "1";
        setAutoPrint(shouldAutoPrint);
        const enc = params.get("draft");
        if (!enc) return setErr("No draft provided");

        const json = decodeURIComponent(enc);
        const parsed = JSON.parse(atob(json));

        const r = await fetch("/api/receipts/render-html", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft: parsed }),
          cache: "no-store",
        });

        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.error || "Failed to render receipt");
        }

        const j = await r.json();
        setHtml(j.html || "");
      } catch (e: any) {
        setErr(e?.message || "Invalid draft data");
      }
    })();
  }, []);

  useEffect(() => {
    if (!autoPrint || !html) return;
    const timer = window.setTimeout(() => window.print(), 0);
    return () => window.clearTimeout(timer);
  }, [autoPrint, html]);

  if (err) return <div className="p-6">{err}</div>;
  if (!html) return <div className="p-6">Loading preview.</div>;

  return (
    <div className="receipt-screen receipt-print-area p-4 bg-white min-h-screen flex justify-center items-start">
      <div className="bg-white max-w-4xl w-full p-8">
        <div className="no-print flex justify-end mb-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200"
          >
            Print Receipt
          </button>
        </div>

        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
