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
  return HTML_ENTITY_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

export function sanitizeProductDescription(value: string | null | undefined) {
  let text = String(value || "").trim();
  if (!text) return "";

  text = text
    .replace(/<a\s+[^>]*href=["']((?:https?:\/\/|mailto:|tel:)[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href, label) => `[${String(label).replace(/<[^>]+>/g, "").trim()}](${href})`)
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

