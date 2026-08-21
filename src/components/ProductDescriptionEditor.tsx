"use client";

import { useRef } from "react";
import MarkdownRendererClient from "@/components/MarkdownRendererClient";

type ProductDescriptionEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

type FormatAction = "paragraph" | "heading" | "bold" | "italic" | "bullets" | "numbered" | "link" | "break";

const toolbarActions: Array<{ action: FormatAction; label: string; title: string }> = [
  { action: "paragraph", label: "Paragraph", title: "Start a paragraph" },
  { action: "heading", label: "Heading", title: "Format as a section heading" },
  { action: "bold", label: "Bold", title: "Make selected text bold" },
  { action: "italic", label: "Italic", title: "Italicize selected text" },
  { action: "bullets", label: "Bullets", title: "Format selected lines as bullets" },
  { action: "numbered", label: "Numbered", title: "Format selected lines as a numbered list" },
  { action: "link", label: "Link", title: "Add a link" },
  { action: "break", label: "Line break", title: "Insert a paragraph break" },
];

function formatSelection(value: string, start: number, end: number, action: FormatAction) {
  const selected = value.slice(start, end);
  const fallback = action === "heading" ? "Section heading" : action === "link" ? "Link text" : "Text";
  const content = selected || fallback;
  let replacement = content;

  if (action === "paragraph") replacement = `\n\n${content}`;
  if (action === "heading") replacement = `## ${content.replace(/^#{1,3}\s*/, "")}`;
  if (action === "bold") replacement = `**${content}**`;
  if (action === "italic") replacement = `*${content}*`;
  if (action === "link") replacement = `[${content}](https://)`;
  if (action === "break") replacement = "\n\n";
  if (action === "bullets" || action === "numbered") {
    replacement = content
      .split(/\r?\n/)
      .map((line, index) => `${action === "bullets" ? "-" : `${index + 1}.`} ${line.replace(/^(?:[-*+] |\d+[.)] )/, "")}`)
      .join("\n");
  }

  return {
    value: `${value.slice(0, start)}${replacement}${value.slice(end)}`,
    selectionStart: start,
    selectionEnd: start + replacement.length,
  };
}

export default function ProductDescriptionEditor({ value, onChange, disabled = false }: ProductDescriptionEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const applyFormat = (action: FormatAction) => {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;
    const result = formatSelection(value, textarea.selectionStart, textarea.selectionEnd, action);
    onChange(result.value);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/70">
      <div className="flex flex-wrap gap-1.5 border-b border-slate-800 bg-slate-900/80 p-2" role="toolbar" aria-label="Product description formatting">
        {toolbarActions.map((item) => (
          <button
            key={item.action}
            type="button"
            title={item.title}
            disabled={disabled}
            onClick={() => applyFormat(item.action)}
            className={`min-h-9 rounded-lg border border-slate-700 px-2.5 text-xs font-semibold text-slate-200 transition hover:border-emerald-400/50 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40 ${item.action === "bold" ? "font-black" : item.action === "italic" ? "italic" : ""}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2">
        <div className="border-b border-slate-800 lg:border-b-0 lg:border-r">
          <div className="px-3 pt-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Edit description</div>
          <textarea
            ref={textareaRef}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Add an overview, headings, lists, links, and product details."
            className="min-h-[320px] w-full resize-y bg-transparent px-3 py-3 font-mono text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="min-h-[320px] bg-slate-900/45 p-4">
          <div className="mb-4 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Live storefront preview</div>
          {value.trim() ? (
            <MarkdownRendererClient mdText={value} variant="admin-preview" />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 p-5 text-sm leading-6 text-slate-500">
              Formatted headings, paragraphs, lists, bold text, and links will appear here before you save.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
