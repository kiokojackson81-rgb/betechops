"use client";

import React, { useEffect, useState } from "react";
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
const PREF_KEY = "betech.richFormatting";

export function useRichFormatting() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw === null) return true;
      return raw === "1" || raw === "true";
    } catch (e) {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, enabled ? "1" : "0");
    } catch (e) {
      // ignore
    }
  }, [enabled]);
  return { enabled, setEnabled };
}

export default function MarkdownRendererClient({ mdText, enabled = true }: { mdText?: string | null; enabled?: boolean }) {
  if (!mdText) return null;
  if (!enabled) return <div className="whitespace-pre-wrap text-sm text-slate-200">{mdText}</div>;
  const html = DOMPurify.sanitize(md.render(String(mdText || "")));
  return <div className="prose max-w-none text-slate-200" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function RichFormattingToggle({ className }: { className?: string }) {
  const { enabled, setEnabled } = useRichFormatting();
  return (
    <label className={`inline-flex items-center gap-2 text-xs ${className ?? ""}`}>
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => setEnabled(e.target.checked)}
        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500"
      />
      <span className="text-slate-400">Rich format</span>
    </label>
  );
}
