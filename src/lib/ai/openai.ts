import OpenAI from "openai";

export function getOpenAiClient() {
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  return new OpenAI({ apiKey });
}

export function extractJsonObject(raw: string) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) throw new Error("AI returned an empty response");

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  const candidate = fenced?.[1] ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  const jsonText = start >= 0 && end >= start ? candidate.slice(start, end + 1) : candidate;
  return JSON.parse(jsonText);
}

export function responseText(response: { output_text?: string | null } | null | undefined) {
  return String(response?.output_text ?? "").trim();
}
