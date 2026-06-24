"use client";

import React, { useEffect, useState } from "react";

const PREF_KEY = "betech.richFormatting";

export function useRichFormatting() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return true;
      const raw = localStorage.getItem(PREF_KEY);
      if (raw === null) return true;
      return raw === "1" || raw === "true";
    } catch (e) {
      return true;
    }
  });
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(PREF_KEY, enabled ? "1" : "0");
    } catch (e) {
      // ignore
    }
  }, [enabled]);
  return { enabled, setEnabled };
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text: string) {
  // escaped text as input
  let t = text;
  // code spans `code`
  t = t.replace(/`([^`]+?)`/g, "<code>$1</code>");
  // strong **bold**
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // emphasis *italic*
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // simple link detection
  t = t.replace(/(https?:\/\/[^\s]+)/g, "<a href='$1' target='_blank' rel='noopener noreferrer'>$1</a>");
  return t;
}

export default function MarkdownRendererClient({ mdText, enabled = true }: { mdText?: string | null; enabled?: boolean }) {
  if (!mdText) return null;
  const raw = String(mdText || "");
  if (!enabled) return <div className="whitespace-pre-wrap text-sm text-slate-200">{raw}</div>;

  // Lightweight, dependency-free markdown-ish renderer:
  // - paragraphs from blank lines
  // - unordered lists with lines starting with `- `
  // - inline `**bold**`, `*italic*`, `\`code\``, and http/https links
  const lines = raw.split(/\r?\n/);
  let html = "";
  let inList = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimRight();
    if (line.match(/^\s*$/)) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      continue;
    }
    const headingMatch = line.match(/^\s*#{1,3}\s+(.*)$/);
    if (headingMatch) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      const content = escapeHtml(headingMatch[1].trim());
      html += `<h3>${renderInline(content)}</h3>`;
      continue;
    }
    const listMatch = line.match(/^\s*[-*+]\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        html += "<ul class='list-disc pl-5'>";
        inList = true;
      }
      const content = escapeHtml(listMatch[1]);
      html += `<li>${renderInline(content)}</li>`;
      continue;
    }
    // normal paragraph
    if (inList) {
      html += "</ul>";
      inList = false;
    }
    const content = escapeHtml(line);
    html += `<p>${renderInline(content)}</p>`;
  }
  if (inList) html += "</ul>";

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
