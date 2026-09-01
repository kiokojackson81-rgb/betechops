"use client";

import React, { useEffect, useState } from "react";
import {
  hasRichProductDescriptionHtml,
  sanitizeProductDescription,
  sanitizeRichProductDescriptionHtml,
} from "@/lib/productDescriptionFormatting";

const PREF_KEY = "betech.richFormatting";

type RendererVariant = "default" | "storefront" | "admin-preview";
type MarkdownListBlock = {
  type: "unordered-list" | "ordered-list";
  items: string[];
};
type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | MarkdownListBlock;

export function useRichFormatting() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return true;
      const raw = localStorage.getItem(PREF_KEY);
      if (raw === null) return true;
      return raw === "1" || raw === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, enabled ? "1" : "0");
    } catch {
      // Formatting preferences are optional when storage is unavailable.
    }
  }, [enabled]);

  return { enabled, setEnabled };
}

function normalizeLegacyMarkdown(value: string) {
  return sanitizeProductDescription(value)
    .replace(/\s+(?=#{1,3}\s+)/g, "\n\n")
    .replace(/\s+-\s+(?=(?:[A-Z0-9*]|✅|✔|•))/g, "\n- ")
    .replace(/^(#{1,3}\s+[^:\n]{2,60}):\s+(.+)$/gm, "$1\n\n$2")
    .trim();
}

function parseMarkdownBlocks(value: string): MarkdownBlock[] {
  const lines = normalizeLegacyMarkdown(value).split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ type: "paragraph", text });
    paragraph = [];
  };
  for (const sourceLine of lines) {
    const line = sourceLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2].trim(),
      });
      continue;
    }

    const unorderedItem = line.match(/^[-*+•]\s+(.+)$/);
    const orderedItem = line.match(/^\d+[.)]\s+(.+)$/);
    if (unorderedItem || orderedItem) {
      flushParagraph();
      const type = unorderedItem ? "unordered-list" : "ordered-list";
      const item = (unorderedItem?.[1] || orderedItem?.[1] || "").trim();
      const previous = blocks[blocks.length - 1];
      if (previous?.type === type) previous.items.push(item);
      else blocks.push({ type, items: [item] });
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return blocks;
}

const INLINE_PATTERN =
  /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|mailto:|tel:)[^)]+\)|https?:\/\/[^\s<]+)/g;

function renderInline(text: string, variant: RendererVariant) {
  return text
    .split(INLINE_PATTERN)
    .filter(Boolean)
    .map((part, index) => {
      const key = `${index}-${part.slice(0, 16)}`;
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={key} className="font-extrabold text-current">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("*") && part.endsWith("*"))
        return <em key={key}>{part.slice(1, -1)}</em>;
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={key}
            className="rounded bg-slate-950/8 px-1.5 py-0.5 font-mono text-[0.9em]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      const markdownLink = part.match(
        /^\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:)[^)]+)\)$/,
      );
      const href = markdownLink?.[2] || (part.startsWith("http") ? part : null);
      if (href) {
        return (
          <a
            key={key}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            className={`font-bold underline decoration-[#d9a318] decoration-2 underline-offset-4 ${variant === "storefront" ? "text-[#8f1111] hover:text-[#5f0000]" : "text-cyan-300 hover:text-cyan-200"}`}
          >
            {markdownLink?.[1] || part}
          </a>
        );
      }
      return <React.Fragment key={key}>{part}</React.Fragment>;
    });
}

const variantClasses: Record<RendererVariant, string> = {
  default: "text-slate-200",
  storefront: "text-slate-700",
  "admin-preview": "text-slate-200",
};

export default function MarkdownRendererClient({
  mdText,
  enabled = true,
  variant = "default",
  className = "",
}: {
  mdText?: string | null;
  enabled?: boolean;
  variant?: RendererVariant;
  className?: string;
}) {
  if (!mdText) return null;
  const raw = String(mdText);
  if (hasRichProductDescriptionHtml(raw)) {
    const safeHtml = sanitizeRichProductDescriptionHtml(raw);
    const richLinkClass =
      variant === "storefront"
        ? "[&_a]:text-[#8f1111] [&_a:hover]:text-[#5f0000]"
        : "[&_a]:text-cyan-300 [&_a:hover]:text-cyan-200";
    return (
      <div
        className={`max-w-[78ch] break-words text-[15px] leading-7 [overflow-wrap:anywhere] sm:text-base sm:leading-8 ${variantClasses[variant]} [&_a]:font-bold [&_a]:underline [&_a]:decoration-[#d9a318] [&_a]:decoration-2 [&_a]:underline-offset-4 ${richLinkClass} [&_h1]:mt-7 [&_h1]:text-2xl [&_h1]:font-black [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-black [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-black [&_h4]:mt-4 [&_h4]:font-bold [&_h5]:mt-4 [&_h5]:font-bold [&_h6]:mt-4 [&_h6]:font-bold [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-2.5 [&_ol]:pl-6 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2.5 [&_ul]:pl-6 first:[&_h1]:mt-0 first:[&_h2]:mt-0 first:[&_h3]:mt-0 first:[&_h4]:mt-0 first:[&_h5]:mt-0 first:[&_h6]:mt-0 first:[&_p]:mt-0 ${className}`}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }
  if (!enabled)
    return (
      <div
        className={`whitespace-pre-wrap break-words text-sm leading-7 ${variantClasses[variant]} ${className}`}
      >
        {raw}
      </div>
    );

  const blocks = parseMarkdownBlocks(raw);
  const headingTextClass =
    variant === "storefront" ? "text-slate-950" : "text-white";
  return (
    <div
      className={`max-w-[78ch] break-words text-[15px] leading-7 [overflow-wrap:anywhere] sm:text-base sm:leading-8 ${variantClasses[variant]} ${className}`}
    >
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "heading") {
          const headingClass =
            block.level === 1
              ? "mt-7 text-xl sm:text-2xl"
              : block.level === 2
                ? "mt-6 text-lg sm:text-xl"
                : "mt-5 text-base sm:text-lg";
          return (
            <h3
              key={key}
              className={`${index === 0 ? "mt-0" : headingClass} mb-2 font-black tracking-tight ${headingTextClass}`}
            >
              {renderInline(block.text, variant)}
            </h3>
          );
        }
        if (block.type === "paragraph")
          return (
            <p key={key} className={index === 0 ? "mt-0" : "mt-3"}>
              {renderInline(block.text, variant)}
            </p>
          );

        const ListTag = block.type === "ordered-list" ? "ol" : "ul";
        return (
          <ListTag
            key={key}
            className={`mt-3 grid gap-2.5 pl-6 ${block.type === "ordered-list" ? "list-decimal" : "list-disc"} marker:font-bold marker:text-[#8f1111]`}
          >
            {block.items.map((item, itemIndex) => (
              <li key={`${itemIndex}-${item}`} className="pl-1">
                {renderInline(item, variant)}
              </li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}

export function RichFormattingToggle({ className }: { className?: string }) {
  const { enabled, setEnabled } = useRichFormatting();
  return (
    <label
      className={`inline-flex items-center gap-2 text-xs ${className ?? ""}`}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => setEnabled(event.target.checked)}
        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500"
      />
      <span className="text-slate-400">Rich format</span>
    </label>
  );
}
