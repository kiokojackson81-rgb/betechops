const BLOCK_TAG_REPLACEMENTS: Array<[RegExp, string]> = [
  [/<br\s*\/?>/gi, "\n"],
  [/<\/p>/gi, "\n\n"],
  [/<\/div>/gi, "\n\n"],
  [/<\/h[1-6]>/gi, "\n\n"],
  [/<\/ul>/gi, "\n"],
  [/<\/ol>/gi, "\n"],
  [/<li[^>]*>/gi, "- "],
  [/<\/li>/gi, "\n"],
  [/<p[^>]*>/gi, ""],
  [/<div[^>]*>/gi, ""],
  [/<h[1-6][^>]*>/gi, "## "],
  [/<ul[^>]*>/gi, ""],
  [/<ol[^>]*>/gi, ""],
];

const HTML_ENTITY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/&nbsp;/gi, " "],
  [/&amp;/gi, "&"],
  [/&quot;/gi, '"'],
  [/&#39;/gi, "'"],
  [/&lt;/gi, "<"],
  [/&gt;/gi, ">"],
];

function decodeHtmlEntities(value: string) {
  return HTML_ENTITY_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  );
}

const RICH_DESCRIPTION_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "strong",
  "b",
  "em",
  "i",
  "a",
  "br",
]);

export function hasRichProductDescriptionHtml(
  value: string | null | undefined,
) {
  return /<\/?(?:p|h[1-6]|ul|ol|li|strong|b|em|i|a|br)\b[^>]*>/i.test(
    String(value || ""),
  );
}

/** Keeps only presentation markup accepted by the storefront renderer. */
export function sanitizeRichProductDescriptionHtml(
  value: string | null | undefined,
) {
  const source = String(value || "").trim();
  if (!source) return "";

  return source
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(
      /<(?:script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\/(?:script|style|iframe|object|embed|svg|math)>/gi,
      "",
    )
    .replace(/<(?:script|style|iframe|object|embed|svg|math)[^>]*\/?\s*>/gi, "")
    .replace(/<\/?([a-z0-9]+)(?:\s[^>]*)?>/gi, (match, rawTag: string) => {
      const tag = rawTag.toLowerCase();
      if (!RICH_DESCRIPTION_TAGS.has(tag)) return "";
      if (match.startsWith("</")) return `</${tag}>`;
      if (tag !== "a") return `<${tag}>`;

      const hrefMatch = match.match(/\bhref\s*=\s*(["'])(.*?)\1/i);
      const href = hrefMatch?.[2]?.trim() || "";
      if (!/^(https?:\/\/|mailto:|tel:)/i.test(href)) return "<a>";
      return `<a href="${href.replace(/"/g, "&quot;")}">`;
    })
    .trim();
}

export function sanitizeProductDescription(value: string | null | undefined) {
  let text = String(value || "").trim();
  if (!text) return "";

  text = text
    .replace(
      /<a\s+[^>]*href=["']((?:https?:\/\/|mailto:|tel:)[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_match, href, label) =>
        `[${String(label)
          .replace(/<[^>]+>/g, "")
          .trim()}](${href})`,
    )
    .replace(/<(?:strong|b)[^>]*>/gi, "**")
    .replace(/<\/(?:strong|b)>/gi, "**")
    .replace(/<(?:em|i)[^>]*>/gi, "*")
    .replace(/<\/(?:em|i)>/gi, "*");

  for (const [pattern, replacement] of BLOCK_TAG_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  text = text.replace(/<[^>]+>/g, " ");
  text = decodeHtmlEntities(text);

  text = text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([:.,!?;])/g, "$1")
    .trim();

  return text;
}

export function sanitizeProductSpecificationLines(value: unknown) {
  const text = sanitizeProductDescription(
    Array.isArray(value)
      ? value.map((item) => String(item || "")).join("\n")
      : typeof value === "string"
        ? value
        : "",
  );

  return text
    .split(/\r?\n|(?=## )/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}
