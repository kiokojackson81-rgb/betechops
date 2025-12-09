"use client";
import React, { useEffect, useState } from "react";
import ReceiptPrintView from "../_components/ReceiptPrintView";

export default function ReceiptPreviewPage() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const enc = params.get("draft");
      if (!enc) return setErr("No draft provided");
      const json = decodeURIComponent(enc);
      const parsed = JSON.parse(atob(json));
      setData(parsed);
    } catch (e) {
      setErr("Invalid draft data");
    }
  }, []);

  if (err) return <div className="p-6">{err}</div>;
  if (!data) return <div className="p-6">Loading preview…</div>;

  return (
    <div className="p-6 bg-slate-100 min-h-screen flex justify-center">
      <div className="bg-white shadow max-w-4xl w-full p-8">
        <ReceiptPrintView data={data} mode="preview" />
      </div>
    </div>
  );
}
