"use client";
import React, { useEffect, useState } from "react";

export default function ReceiptPreviewPage() {
  const [html, setHtml] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);

  const fromBase64Utf8 = (encoded: string) => {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  };

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const shouldAutoPrint = params.get("autoPrint") === "1";
        setAutoPrint(shouldAutoPrint);
        const enc = params.get("draft");
        if (!enc) return setErr("No draft provided");

        const json = decodeURIComponent(enc);
        let parsed: any = null;
        try {
          parsed = JSON.parse(fromBase64Utf8(json));
        } catch {
          // Backward compatibility for older Latin1-only draft links.
          parsed = JSON.parse(atob(json));
        }

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

  const printableHtml = html
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<\/?(html|head|body)[^>]*>/gi, "");

  return (
    <div className="receipt-preview-host bg-white">
      <div className="no-print flex justify-end p-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200"
        >
          Print Receipt
        </button>
      </div>
      <div dangerouslySetInnerHTML={{ __html: printableHtml }} />
    </div>
  );
}
